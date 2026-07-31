const baseUrl = (process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://specsdekh.com').replace(/\/$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

const checks = [
  { path: '/', label: 'Homepage' },
  { path: '/phones', label: 'Phones' },
  { path: '/compare', label: 'Compare' },
  { path: '/brands', label: 'Brands' },
  { path: '/admin/login', label: 'Admin login' },
  { path: '/api/brands', label: 'Brands API', contentType: 'application/json' },
  { path: '/api/phones', label: 'Phones API', contentType: 'application/json' },
];

async function checkRoute(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${baseUrl}${check.path}`;
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'SpecsDekh-Release-Smoke-Test/1.0' },
    });
    const type = response.headers.get('content-type') || '';
    const okStatus = response.status >= 200 && response.status < 400;
    const okType = !check.contentType || type.includes(check.contentType);
    return {
      ...check,
      url,
      status: response.status,
      contentType: type,
      ok: okStatus && okType,
      error: okStatus && !okType ? `Expected ${check.contentType}, received ${type || 'unknown'}` : undefined,
    };
  } catch (error) {
    return {
      ...check,
      url,
      status: 0,
      contentType: '',
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

console.log(`Running production smoke test against ${baseUrl}`);
const results = [];
for (const check of checks) {
  const result = await checkRoute(check);
  results.push(result);
  const mark = result.ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${result.label}: ${result.status || '-'} ${result.url}${result.error ? ` — ${result.error}` : ''}`);
}

const failures = results.filter(result => !result.ok);
if (failures.length > 0) {
  console.error(`Smoke test failed: ${failures.length}/${results.length} checks failed.`);
  process.exit(1);
}

console.log(`Smoke test passed: ${results.length}/${results.length} checks succeeded.`);
