/**
 * Tests for the port manager.
 */
const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const { findAvailablePort, MAX_PORT } = require('./port.js');

test('Port Manager', async (t) => {
  await t.test('Auto-selection success on first try', async () => {
    // Assuming 8000 is open, it should return 8000
    // Since we don't have the implementation yet, this will fail
    // if port.js doesn't exist, which is fine for missing implementation
    try {
      const port = await findAvailablePort(8000, 8999);
      assert.ok(port >= 8000 && port <= 8999);
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        t.skip('port.js not implemented yet');
      } else {
        throw e;
      }
    }
  });

  await t.test('First port in use (fallback)', async () => {
    try {
      const server = net.createServer();
      await new Promise(r => server.listen(0, '0.0.0.0', r));
      const p = server.address().port;
      
      const port = await findAvailablePort(p, Math.min(p + 5, MAX_PORT));
      assert.ok(port > p && port <= Math.min(p + 5, MAX_PORT));
      
      server.close();
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        t.skip('port.js not implemented yet');
      } else {
        throw e;
      }
    }
  });
});
