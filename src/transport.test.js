/**
 * src/transport.test.js
 * Tests for transport selection policy and signaling orchestration.
 */
const test = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('node:events');
const { pickTransport } = require('./transport.js');
const { SignalingRoom } = require('./signaling.js');

test('pickTransport Policy Selection', async (t) => {
  
  await t.test('Step 1: forceMesh selects mesh when mesh is true', async () => {
    const result = await pickTransport({ mesh: true });
    assert.strictEqual(result, 'mesh');
  });

  await t.test('Step 2: forceLan selects lan when mesh is false', async () => {
    const result = await pickTransport({ mesh: false });
    assert.strictEqual(result, 'lan');
  });

  await t.test('Step 3: peers present selects lan when mdns has peer found', async () => {
    const mockMdns = {
      hasPeerFound: () => true
    };
    const result = await pickTransport({ mdns: mockMdns });
    assert.strictEqual(result, 'lan');
  });

  await t.test('Step 4: no mdns peer with signal URL falls back to mesh after timeout', async () => {
    const mockMdns = new EventEmitter();
    mockMdns.hasPeerFound = () => false;

    const start = Date.now();
    const result = await pickTransport({
      signalUrl: 'ws://mock-signal',
      mdns: mockMdns,
      timeoutMs: 100 // Short timeout for testing speed
    });
    const elapsed = Date.now() - start;

    assert.strictEqual(result, 'mesh');
    assert.ok(elapsed >= 90, `Should have waited at least 100ms, elapsed: ${elapsed}`);
  });

  await t.test('Step 4: mid-boot peer arrival selects lan immediately', async () => {
    const mockMdns = new EventEmitter();
    mockMdns.hasPeerFound = () => false;

    // Simulate mid-boot peer discovery
    setTimeout(() => {
      mockMdns.emit('peer-found');
    }, 50);

    const start = Date.now();
    const result = await pickTransport({
      signalUrl: 'ws://mock-signal',
      mdns: mockMdns,
      timeoutMs: 300
    });
    const elapsed = Date.now() - start;

    assert.strictEqual(result, 'lan');
    assert.ok(elapsed < 200, `Should have resolved early when peer arrived, elapsed: ${elapsed}`);
  });

  await t.test('Step 5: default LAN selects lan when no signal URL is present', async () => {
    const mockMdns = {
      hasPeerFound: () => false
    };
    const result = await pickTransport({ mdns: mockMdns });
    assert.strictEqual(result, 'lan');
  });

});

test('Signaling Room Teardown', async (t) => {
  await t.test('SignalingRoom join and leave change state correctly', async () => {
    const room = new SignalingRoom('ws://signal-url', 'test-room');
    assert.strictEqual(room.joined, false);
    assert.strictEqual(room.closed, false);

    await room.join();
    assert.strictEqual(room.joined, true);
    assert.strictEqual(room.closed, false);

    await room.leave();
    assert.strictEqual(room.joined, false);
    assert.strictEqual(room.closed, true);
  });
});
