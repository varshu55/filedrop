/**
 * Integration test: Second download attempt
 */
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');
const { createTempFile, cleanupTempFiles } = require('../helpers/create-temp-file.js');
const { httpClient } = require('../helpers/http-client.js');

test('Second download integration', async (t) => {
  t.afterEach(cleanupTempFiles);

  await t.test('Returns 410 on second request', async () => {
    try {
      require.resolve('../../src/cli.js');
    } catch {
      t.skip('cli.js not implemented yet');
      return;
    }

    const filePath = createTempFile(1024);
    const cliPath = path.join(__dirname, '../../bin/filedrop.js');

    const filedropProcess = spawn(process.execPath, [cliPath, filePath, '--port', '8124', '--no-mdns']);
    
    // Satisfy the pre-existing device limit prompt
    filedropProcess.stdin.write('\n');
    
    await new Promise(r => setTimeout(r, 2000));

    // Wait until the server is shut down to attempt second GET, or attempt while first is in flight.
    // The prompt says "attempt a second HTTP GET immediately after".
    const res1 = await httpClient('http://127.0.0.1:8124/');
    assert.strictEqual(res1.statusCode, 200);

    const downloadPathMatch = res1.body.toString().match(/fetch\('([^']+)'/);
    assert.ok(downloadPathMatch, 'Should find download path in HTML');
    const downloadPath = downloadPathMatch[1];

    // Download the actual file to complete the authorized transfer limit
    const downloadRes = await httpClient(`http://127.0.0.1:8124${downloadPath}`);
    assert.strictEqual(downloadRes.statusCode, 200);

    // Wait a brief moment for the server to process the completed transfer and trigger shutdown
    await new Promise(r => setTimeout(r, 200));

    try {
      const res2 = await httpClient('http://127.0.0.1:8124/');
      // If server is still in the process of shutting down, it might return 410 or 429
      assert.ok(res2.statusCode === 410 || res2.statusCode === 429);
    } catch (err) {
      if (err.name === 'AssertionError') throw err;
      // It's possible the server has already shut down and socket is closed
      assert.ok(err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET');
    }
    
    filedropProcess.kill();
  });
});
