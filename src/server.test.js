/**
 * Tests for the ephemeral HTTP server module (v2.0 Architecture).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createServer } = require('./server.js');
const pkg = require('../package.json');
const { createTempFile, cleanupTempFiles } = require('../test/helpers/create-temp-file.js');
const { httpClient } = require('../test/helpers/http-client.js');

test('Server Core', async (t) => {
  t.afterEach(cleanupTempFiles);

  await t.test('GET / returns HTML payload', async () => {
    const filePath = createTempFile(1024, '.txt');
    const { server, shutdown } = await createServer({
      filePath,
      port: 0,
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/`;
    const res = await httpClient(url);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'text/html; charset=utf-8');
    assert.ok(res.body.toString().includes('<!DOCTYPE html>'));

    await shutdown();
  });

  await t.test('GET / injects the detected MIME type for single-file transfers', async () => {
    const filePath = createTempFile(1024, '.pdf');
    const { server, shutdown, downloadPath } = await createServer({
      filePath,
      port: 0,
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const htmlRes = await httpClient(`http://127.0.0.1:${port}/`);
    const downloadRes = await httpClient(`http://127.0.0.1:${port}${downloadPath}`);

    assert.match(htmlRes.body.toString(), /type: "application\/pdf"/);
    assert.strictEqual(downloadRes.headers['content-type'], 'application/pdf');

    await shutdown();
  });

  await t.test('GET downloadPath uses application/zip for directory downloads', async () => {
    const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'filedrop-dir-'));
    try {
      const nestedFilePath = path.join(dirPath, 'nested.txt');
      fs.writeFileSync(nestedFilePath, 'hello world');

      const { server, shutdown, downloadPath } = await createServer({
        filePath: dirPath,
        isDirectory: true,
        port: 0,
        onTransferComplete: () => {},
        onTransferError: () => {}
      });

      const port = server.address().port;
      const htmlRes = await httpClient(`http://127.0.0.1:${port}/`);
      const downloadRes = await httpClient(`http://127.0.0.1:${port}${downloadPath}`);

      assert.match(htmlRes.body.toString(), /type: "application\/zip"/);
      assert.strictEqual(downloadRes.headers['content-type'], 'application/zip');

      await shutdown();
    } finally {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });

  await t.test('GET / injects text/plain for clipboard transfers', async () => {
    const { server, shutdown, downloadPath } = await createServer({
      clipboardData: 'clipboard content',
      isClipboard: true,
      port: 0,
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const htmlRes = await httpClient(`http://127.0.0.1:${port}/`);
    const downloadRes = await httpClient(`http://127.0.0.1:${port}${downloadPath}`);

    assert.match(htmlRes.body.toString(), /type: "text\/plain"/);
    assert.strictEqual(downloadRes.headers['content-type'], 'text/plain');

    await shutdown();
  });

  await t.test('GET downloadPath returns encrypted file', async () => {
    const filePath = createTempFile(1024, '.txt');
    let transferCompleted = false;

    const { server, shutdown, downloadPath } = await createServer({
      filePath,
      port: 0,
      onTransferComplete: () => { transferCompleted = true; },
      onTransferError: () => {}
    });

    const port = server.address().port;
    const url = `http://127.0.0.1:${port}${downloadPath}`;
    const res = await httpClient(url);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'text/plain');
    assert.strictEqual(res.headers['content-length'], String(1024 + 28)); // 1024 + IV(12) + AuthTag(16)
    assert.ok(res.headers['content-disposition'].includes('attachment'));
    assert.strictEqual(res.headers['cache-control'], 'no-store');
    assert.strictEqual(res.body.length, 1024 + 28);

    await new Promise(r => setTimeout(r, 50)); // let socket close event fire
    assert.strictEqual(transferCompleted, true);

    await shutdown();
  });

  await t.test('HEAD downloadPath returns headers, no body', async () => {
    const filePath = createTempFile(1024, '.txt');
    const { server, shutdown, downloadPath } = await createServer({
      filePath,
      port: 0,
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const url = `http://127.0.0.1:${port}${downloadPath}`;
    const res = await httpClient(url, { method: 'HEAD' });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-length'], String(1024 + 28));
    assert.strictEqual(res.body.length, 0);

    await shutdown();
  });

  await t.test('X-Filedrop-Version header uses package version for download responses', async () => {
    const filePath = createTempFile(1024, '.txt');
    const { server, shutdown, downloadPath } = await createServer({
      filePath,
      port: 0,
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const url = `http://127.0.0.1:${port}${downloadPath}`;

    const headRes = await httpClient(url, { method: 'HEAD', agent: false });
    assert.strictEqual(headRes.statusCode, 200);
    assert.strictEqual(headRes.headers['x-filedrop-version'], pkg.version);

    const getRes = await httpClient(url, { agent: false });
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.headers['x-filedrop-version'], pkg.version);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const secondGetRes = await httpClient(url, { agent: false });
    assert.strictEqual(secondGetRes.statusCode, 410);
    assert.strictEqual(secondGetRes.headers['x-filedrop-version'], pkg.version);

    await shutdown();
  });

  await t.test('Immediate retry after client disconnect is rejected with 429', async () => {
    const filePath = createTempFile(1024 * 1024, '.txt');
    const { server, shutdown, downloadPath } = await createServer({
      filePath,
      port: 0,
      options: {
        transferCleanupDelay: 200
      },
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const url = `http://127.0.0.1:${port}${downloadPath}`;

    const firstReq = http.get(url, (res) => {
      res.on('data', () => {
        firstReq.destroy();
      });
    });

    firstReq.on('error', () => {});
    await new Promise((resolve) => setTimeout(resolve, 20));

    const retryRes = await httpClient(url, { agent: false });
    assert.strictEqual(retryRes.statusCode, 429);
    assert.strictEqual(retryRes.headers['retry-after'], '5');

    await shutdown();
  });

  await t.test('Unknown path returns 404', async () => {
    const filePath = createTempFile(1024, '.txt');
    const { server, shutdown } = await createServer({
      filePath,
      port: 0,
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const res = await httpClient(`http://127.0.0.1:${port}/unknown-path`);

    assert.strictEqual(res.statusCode, 404);
    await shutdown();
  });

  await t.test('Non-GET/HEAD returns 405', async () => {
    const filePath = createTempFile(1024, '.txt');
    const { server, shutdown } = await createServer({
      filePath,
      port: 0,
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const res = await httpClient(`http://127.0.0.1:${port}/`, { method: 'POST' });

    assert.strictEqual(res.statusCode, 405);
    await shutdown();
  });

  await t.test('Custom rate limit options control request threshold and retry header', async () => {
    const filePath = createTempFile(1024, '.txt');
    const { server, shutdown } = await createServer({
      filePath,
      port: 0,
      options: {
        rateLimitWindow: 2000,
        rateLimitMax: 1
      },
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/unknown-path`;

    const res1 = await httpClient(url);
    assert.strictEqual(res1.statusCode, 404);

    const res2 = await httpClient(url);
    assert.strictEqual(res2.statusCode, 429);
    assert.strictEqual(res2.headers['retry-after'], '2');

    await shutdown();
  });

  await t.test('Second GET on downloadPath returns 410', async () => {
    const filePath = createTempFile(1024, '.txt');
    const { server, shutdown, downloadPath } = await createServer({
      filePath,
      port: 0,
      onTransferComplete: () => {},
      onTransferError: () => {}
    });

    const port = server.address().port;
    const url = `http://127.0.0.1:${port}${downloadPath}`;

    const res1 = await httpClient(url);
    assert.strictEqual(res1.statusCode, 200);

    const res2 = await httpClient(url);
    assert.strictEqual(res2.statusCode, 410);

    await shutdown();
  });
});
