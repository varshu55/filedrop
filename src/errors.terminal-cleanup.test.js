const test = require('node:test');
const assert = require('node:assert/strict');
const { registerGlobalErrorHandlers } = require('./errors.js');

test('restores terminal state before fatal exit', (t) => {
  const originalOn = process.on;
  const originalExit = process.exit;
  const originalWrite = process.stdout.write;
  const originalIsTTY = process.stdout.isTTY;
  const originalConsoleError = console.error;
  const originalDebug = process.env.FILEDROP_DEBUG;
  const handlers = {};
  const events = [];

  t.after(() => {
    process.on = originalOn;
    process.exit = originalExit;
    process.stdout.write = originalWrite;
    process.stdout.isTTY = originalIsTTY;
    console.error = originalConsoleError;
    if (originalDebug === undefined) {
      delete process.env.FILEDROP_DEBUG;
    } else {
      process.env.FILEDROP_DEBUG = originalDebug;
    }
  });

  process.on = (event, handler) => {
    handlers[event] = handler;
    return process;
  };
  registerGlobalErrorHandlers();
  process.on = originalOn;

  delete process.env.FILEDROP_DEBUG;
  console.error = () => {};
  process.stdout.write = (chunk) => {
    events.push({ type: 'write', chunk });
    return true;
  };
  process.exit = (code) => {
    events.push({ type: 'exit', code });
  };

  const fatalErrors = [
    ['uncaughtException', new Error('sync failure')],
    ['unhandledRejection', new Error('async failure')]
  ];

  process.stdout.isTTY = true;
  for (const [event, error] of fatalErrors) {
    events.length = 0;
    handlers[event](error);

    assert.deepStrictEqual(events, [
      { type: 'write', chunk: '\x1b[?25h\x1b[0m\n' },
      { type: 'exit', code: 99 }
    ], event);
  }

  process.stdout.isTTY = false;
  for (const [event, error] of fatalErrors) {
    events.length = 0;
    handlers[event](error);

    assert.deepStrictEqual(events, [
      { type: 'exit', code: 99 }
    ], event);
  }
});
