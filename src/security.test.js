const test = require('node:test');
const assert = require('node:assert');
const { validateToken, createConnectionLimiter, isSensitiveFile } = require('./security');

test('Security Helpers', async (t) => {
  await t.test('validateToken', () => {
    // True when no token required
    assert.strictEqual(validateToken('http://localhost/', null), true);
    assert.strictEqual(validateToken('http://localhost/', undefined), true);
    assert.strictEqual(validateToken('http://localhost/', ''), true);

    // Matches valid token in query param
    assert.strictEqual(validateToken('http://localhost/?t=mysecret', 'mysecret'), true);
    // Fails on mismatched token
    assert.strictEqual(validateToken('http://localhost/?t=wrong', 'mysecret'), false);
    // Fails when token query parameter is missing
    assert.strictEqual(validateToken('http://localhost/', 'mysecret'), false);
  });

  await t.test('createConnectionLimiter', () => {
    const limiter = createConnectionLimiter(2);
    let rejectedCount = 0;
    const mockReject = () => { rejectedCount++; };

    const mockSocket1 = { once: (event, cb) => { mockSocket1.onClose = cb; } };
    const mockSocket2 = { once: (event, cb) => { mockSocket2.onClose = cb; } };
    const mockSocket3 = { once: (event, cb) => { mockSocket3.onClose = cb; } };

    // First two allowed
    assert.strictEqual(limiter.handleConnection(mockSocket1, mockReject), true);
    assert.strictEqual(limiter.handleConnection(mockSocket2, mockReject), true);
    assert.strictEqual(rejectedCount, 0);

    // Third one rejected
    assert.strictEqual(limiter.handleConnection(mockSocket3, mockReject), false);
    assert.strictEqual(rejectedCount, 1);

    // Close one socket
    mockSocket1.onClose();

    // Now allowed
    assert.strictEqual(limiter.handleConnection(mockSocket3, mockReject), true);
    assert.strictEqual(rejectedCount, 1);
  });

  await t.test('isSensitiveFile', () => {
    assert.strictEqual(isSensitiveFile('/path/to/key.pem'), true);
    assert.strictEqual(isSensitiveFile('/path/to/my.key'), true);
    assert.strictEqual(isSensitiveFile('/path/to/.env'), true);
    assert.strictEqual(isSensitiveFile('/path/to/.env.production'), true);
    assert.strictEqual(isSensitiveFile('/path/to/id_rsa'), true);
    assert.strictEqual(isSensitiveFile('/path/to/credentials.json'), true);

    // Normal files
    assert.strictEqual(isSensitiveFile('/path/to/image.png'), false);
    assert.strictEqual(isSensitiveFile('/path/to/readme.md'), false);
  });
});
