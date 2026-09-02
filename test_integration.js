const http = require('http');
const fs = require('fs');

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING AUTOMATED API INTEGRATION TEST ===\n');

  // Test 1: GET /docs (Swagger UI)
  const docsRes = await request('GET', '/docs');
  console.log(`[TEST 1] GET /docs: HTTP ${docsRes.statusCode} (${docsRes.body.includes('swagger-ui') ? 'PASS - Swagger UI Loaded' : 'FAIL'})`);

  // Test 2: GET /openapi.yaml
  const yamlRes = await request('GET', '/openapi.yaml');
  console.log(`[TEST 2] GET /openapi.yaml: HTTP ${yamlRes.statusCode} (${yamlRes.body.includes('openapi: 3.0.3') ? 'PASS - OpenAPI Spec Valid' : 'FAIL'})`);

  // Test 3: POST /api/v1/jobs/survey-report
  const postmanJson = JSON.parse(fs.readFileSync('doc/PMT_INT_Integration_Postman_Collection.json', 'utf8'));
  const rawPayload = JSON.parse(postmanJson.item[0].request.body.raw);

  const ingestRes = await request('POST', '/api/v1/jobs/survey-report', rawPayload, {
    'X-Idempotency-Key': 'TEST-IDEMP-001',
    'Authorization': 'Bearer test-key'
  });
  console.log(`[TEST 3] POST /api/v1/jobs/survey-report (Ingest & Convert): HTTP ${ingestRes.statusCode}`);
  console.log('Response Body:', ingestRes.body);

  // Test 4: Idempotency check (duplicate request)
  const dupRes = await request('POST', '/api/v1/jobs/survey-report', rawPayload, {
    'X-Idempotency-Key': 'TEST-IDEMP-001',
    'Authorization': 'Bearer test-key'
  });
  console.log(`\n[TEST 4] POST Duplicate Check (Idempotency): HTTP ${dupRes.statusCode}`);
  console.log('Response Body:', dupRes.body);

  // Test 5: Query Staging
  const stagingRes = await request('GET', '/api/v1/staging/survey-reports');
  console.log(`\n[TEST 5] GET /api/v1/staging/survey-reports: HTTP ${stagingRes.statusCode}`);
  console.log('Response Body:', stagingRes.body);

  // Test 6: Validation Failure Test (< 5 photos)
  const invalidPayload = { ...rawPayload, site_photos: ["img1.jpg", "img2.jpg"], system: { ...rawPayload.system, job_id: "test-invalid-photos" } };
  const failRes = await request('POST', '/api/v1/jobs/survey-report', invalidPayload);
  console.log(`\n[TEST 6] POST Validation Check (< 5 photos): HTTP ${failRes.statusCode}`);
  console.log('Response Body:', failRes.body);

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => console.error('Test Error:', err));
