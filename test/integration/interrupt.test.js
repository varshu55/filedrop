/**
 * Integration test: Interrupt handling
 */
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');
const { createTempFile, cleanupTempFiles } = require('../helpers/create-temp-file.js');

test('Interrupt handling integration', async (t) => {
  t.afterEach(cleanupTempFiles);

  await t.test('Exits cleanly with code 130 on SIGINT', async () => {
    try {
      require.resolve('../../src/cli.js');
    } catch {
      t.skip('cli.js not implemented yet');
      return;
    }

    const filePath = createTempFile(1024);
    const cliPath = path.join(__dirname, '../../bin/filedrop.js');

    const filedropProcess = spawn(process.execPath, [cliPath, filePath, '--port', '8126', '--no-mdns']);
    
    // Satisfy the pre-existing device limit prompt
    filedropProcess.stdin.write('\n');
    
    await new Promise(r => setTimeout(r, 1500));
    
    filedropProcess.kill('SIGINT');
    
    const [code, signal] = await new Promise(resolve => {
      filedropProcess.on('exit', (code, signal) => resolve([code, signal]));
    });
    if (process.platform === 'win32') {
      assert.ok(code === null || code === 130 || signal === 'SIGINT', 'Process should exit on SIGINT');
    } else {
      assert.strictEqual(code, 130, 'Process should exit with code 130 on SIGINT');
    }
  });
});
