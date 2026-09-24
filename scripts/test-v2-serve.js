const http = require('http');
const path = require('path');
const fs = require('fs');

// Test against running server or launch child process
async function runTest() {
  const PORT = 3456;
  process.env.PORT = String(PORT);
  
  // Require compiled dist/server.js
  console.log('Starting server on port ' + PORT + '...');
  require('../dist/server.js');

  // Wait 1.5 seconds for server to start listening
  await new Promise(r => setTimeout(r, 1500));

  function get(urlPath) {
    return new Promise((resolve, reject) => {
      const req = http.get({
        hostname: '127.0.0.1',
        port: PORT,
        path: urlPath,
        headers: { 'Accept': 'text/html,*/*' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      });
      req.on('error', reject);
    });
  }

  const results = [];

  try {
    // 1. Test Legacy Root /
    const rRoot = await get('/');
    console.log(`[1] GET / -> HTTP ${rRoot.status} (${rRoot.body.length} bytes)`);
    results.push({ name: 'Legacy /', pass: rRoot.status === 200 && rRoot.body.includes('PMT') });

    // 2. Test /v2 without trailing slash
    const rV2NoSlash = await get('/v2');
    console.log(`[2a] GET /v2 -> HTTP ${rV2NoSlash.status}`);
    results.push({ name: 'PMT Flow v2 /v2 (Redirect or OK)', pass: [200, 301, 302].includes(rV2NoSlash.status) });

    // 2b. Test /v2/
    const rV2 = await get('/v2/');
    console.log(`[2b] GET /v2/ -> HTTP ${rV2.status} (${rV2.body.length} bytes)`);
    results.push({ name: 'PMT Flow v2 /v2/', pass: rV2.status === 200 && rV2.body.includes('PMT Flow v2') });

    // 3. Test /v2 SPA fallback route /v2/test-route
    const rSpa = await get('/v2/test-route');
    console.log(`[3] GET /v2/test-route -> HTTP ${rSpa.status} (${rSpa.body.length} bytes)`);
    results.push({ name: 'PMT Flow v2 SPA Fallback /v2/test-route', pass: rSpa.status === 200 && rSpa.body.includes('PMT Flow v2') });

    // 4. Test /v2/anything (any deep route)
    const rDeep = await get('/v2/orders/JOB2609-00128?tab=task');
    console.log(`[4] GET /v2/orders/JOB2609-00128?tab=task -> HTTP ${rDeep.status}`);
    results.push({ name: 'PMT Flow v2 Deep SPA Route', pass: rDeep.status === 200 && rDeep.body.includes('PMT Flow v2') });

    // Print summary
    console.log('\n==========================================');
    let allPass = true;
    for (const res of results) {
      console.log(`${res.pass ? '✅' : '❌'} ${res.name}`);
      if (!res.pass) allPass = false;
    }
    console.log('==========================================');

    process.exit(allPass ? 0 : 1);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runTest();
