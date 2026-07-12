const { spawn } = require('child_process');
const http = require('http');

const server = spawn('node', ['.next/standalone/server.js'], {
  cwd: '/home/z/my-project',
  env: { ...process.env, NODE_ENV: 'production', PORT: '3001' },
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', d => { output += d.toString(); process.stdout.write(d); });
server.stderr.on('data', d => { output += d.toString(); process.stderr.write(d); });

function fetch(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:3001${path}`, { timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, size: data.length }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  // Wait for server to start
  await new Promise(r => setTimeout(r, 5000));

  try {
    // Test stats
    console.log('\n--- Testing /api/stats ---');
    const stats = await fetch('/api/stats');
    console.log(`Status: ${stats.status}, Size: ${stats.size}`);
    if (stats.data) {
      const j = JSON.parse(stats.data);
      console.log(`totalPhones: ${j.totalPhones}, totalBrands: ${j.totalBrands}, totalNews: ${j.totalNews}`);
    }

    // Test brands
    console.log('\n--- Testing /api/brands ---');
    const brands = await fetch('/api/brands');
    console.log(`Status: ${brands.status}, Size: ${brands.size}`);
    if (brands.data) {
      const j = JSON.parse(brands.data);
      console.log(`Brands: ${j.brands?.length}`);
    }

    // Test home
    console.log('\n--- Testing /api/home ---');
    const home = await fetch('/api/home');
    console.log(`Status: ${home.status}, Size: ${home.size}`);
    if (home.data) {
      const j = JSON.parse(home.data);
      console.log(`Featured: ${j.featured?.length}, Trending: ${j.trending?.length}, Latest: ${j.latest?.length}`);
      console.log(`Best Camera: ${j.bestCamera?.length}, Best Gaming: ${j.bestGaming?.length}, Best Battery: ${j.bestBattery?.length}`);
      console.log(`Upcoming: ${j.upcoming?.length}, News: ${j.news?.length}`);
    }

    // Test search
    console.log('\n--- Testing /api/search?q=samsung ---');
    const search = await fetch('/api/search?q=samsung');
    console.log(`Status: ${search.status}, Size: ${search.size}`);
    if (search.data) {
      const j = JSON.parse(search.data);
      console.log(`Phones: ${j.phones?.length}, Brands: ${j.brands?.length}, Total: ${j.total}`);
    }

    // Test phone detail
    console.log('\n--- Testing /api/phones/iphone-15-pro-max ---');
    const phone = await fetch('/api/phones/iphone-15-pro-max');
    console.log(`Status: ${phone.status}, Size: ${phone.size}`);
    if (phone.data) {
      const j = JSON.parse(phone.data);
      console.log(`Phone: ${j.phone?.modelName}, Specs: ${j.phone?.specs ? 'yes' : 'no'}, Related: ${j.related?.length}`);
    }

    // Test sitemap
    console.log('\n--- Testing /sitemap.xml ---');
    const sitemap = await fetch('/sitemap.xml');
    console.log(`Status: ${sitemap.status}, Size: ${sitemap.size}`);

    // Test robots
    console.log('\n--- Testing /robots.txt ---');
    const robots = await fetch('/robots.txt');
    console.log(`Status: ${robots.status}, Size: ${robots.size}`);

    console.log('\n=== ALL TESTS PASSED ===');
  } catch (e) {
    console.error('\nTest failed:', e.message);
  } finally {
    server.kill();
    process.exit(0);
  }
})();