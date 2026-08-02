import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
  const p = path.join(dir,e.name); return e.isDirectory() ? walk(p) : [p];
}) : [];
const rel = p => path.relative(root,p).replaceAll('\\','/');
const read = p => fs.readFileSync(p,'utf8');

const adminPages = walk(path.join(root,'src/app/admin')).filter(p => /page\.(tsx|ts|jsx|js)$/.test(p));
const adminSources = walk(path.join(root,'src/app/admin')).filter(p => /\.(tsx|ts|jsx|js)$/.test(p));
const apiSources = walk(path.join(root,'src/app/api')).filter(p => /\.(tsx|ts|jsx|js)$/.test(p));
const apiCorpus = apiSources.map(read).join('\n');

const endpointRows = [];
const staticFetch = /fetch\(\s*([`'"])(\/api\/[^`'"?${}\s]*)[^`'"]*\1/g;
for (const file of adminSources) {
  const text = read(file); let m;
  while ((m = staticFetch.exec(text))) endpointRows.push({file:rel(file), endpoint:m[2]});
}
const uniqueEndpoints = [...new Map(endpointRows.map(x => [x.endpoint,x])).values()].sort((a,b)=>a.endpoint.localeCompare(b.endpoint));
const missingEndpointEvidence = uniqueEndpoints.filter(x => {
  const routePath = path.join(root, 'src/app', x.endpoint, 'route.ts');
  const routePathJs = path.join(root, 'src/app', x.endpoint, 'route.js');
  if (fs.existsSync(routePath) || fs.existsSync(routePathJs)) return false;

  // Catch-all APIs may implement endpoints without a dedicated route folder.
  const pieces = x.endpoint.replace(/^\/api\//,'').split('/').filter(Boolean);
  return !pieces.every(piece => apiCorpus.includes(`'${piece}'`) || apiCorpus.includes(`\"${piece}\"`) || apiCorpus.includes(piece));
});

const findings=[];
for (const file of adminSources) {
  const text=read(file);
  if (/\bTODO\b|\bFIXME\b|not implemented|temporarily unavailable|feature disabled/i.test(text)) findings.push({severity:'medium',type:'placeholder-marker',file:rel(file)});
  if (/disabled=\{true\}/.test(text)) findings.push({severity:'medium',type:'hard-disabled-control',file:rel(file)});
  if (/window\.alert\(|\balert\(/.test(text)) findings.push({severity:'low',type:'browser-alert',file:rel(file)});
}

const required = ['MONGO_URL|MONGODB_URI','JWT_SECRET','NEXT_PUBLIC_BASE_URL','CRON_SECRET'];
const envExample = fs.existsSync('.env.example') ? read('.env.example') : '';
for (const item of required) {
  const options=item.split('|');
  if (!options.some(v=>envExample.includes(v))) findings.push({severity:'high',type:'missing-env-documentation',detail:item});
}

const result={
  generatedAt:new Date().toISOString(),
  adminPages:adminPages.length,
  adminSourceFiles:adminSources.length,
  apiSourceFiles:apiSources.length,
  literalAdminApiEndpoints:uniqueEndpoints.length,
  endpointEvidenceMissing:missingEndpointEvidence,
  findings,
  buildCertification:{
    status:'blocked-in-audit-environment',
    command:'npm ci --ignore-scripts',
    blocker:'Internal npm mirror returns 404 for transitive zod-validation-error@4.0.2 required by eslint-plugin-react-hooks.'
  }
};
fs.mkdirSync(path.join(root,'audit-output'),{recursive:true});
fs.writeFileSync(path.join(root,'audit-output/admin-production-audit.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if (missingEndpointEvidence.length) process.exitCode=2;
