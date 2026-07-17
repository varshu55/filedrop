const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
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
  let flushCleanup;
  process.stdout.write = (chunk, callback) => {
    events.push({ type: 'write', chunk });
    flushCleanup = callback;
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
    flushCleanup = undefined;
    handlers[event](error);

    assert.deepStrictEqual(events, [
      { type: 'write', chunk: '\x1b[?25h\x1b[0m\n' }
    ], event);

    assert.equal(typeof flushCleanup, 'function', `${event} supplies a flush callback`);
    flushCleanup();
    assert.deepStrictEqual(events.at(-1), { type: 'exit', code: 99 }, event);
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

test('CLI registers the shared global error handlers before loading the orchestrator', (t) => {
  const cliPath = require.resolve('../bin/filedrop.js');
  const originalLoad = Module._load;
  const originalUnhandledRejectionListeners = process.listeners('unhandledRejection');
  let registrations = 0;
  let orchestratorLoaded = false;

  t.after(() => {
    Module._load = originalLoad;
    delete require.cache[cliPath];
    for (const listener of process.listeners('unhandledRejection')) {
      if (!originalUnhandledRejectionListeners.includes(listener)) {
        process.removeListener('unhandledRejection', listener);
      }
    }
  });

  Module._load = function (request, parent, isMain) {
    if (parent?.filename === cliPath && request === '../src/errors') {
      return {
        registerGlobalErrorHandlers() {
          registrations += 1;
        }
      };
    }
    if (parent?.filename === cliPath && request === '../src/index.js') {
      orchestratorLoaded = true;
      return {};
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[cliPath];
  require(cliPath);

  assert.equal(registrations, 1);
  assert.equal(orchestratorLoaded, true);
});

test('top-level orchestrator failures use the shared unexpected-error handler', async (t) => {
  const indexPath = require.resolve('./index.js');
  const originalLoad = Module._load;
  const originalExit = process.exit;
  const originalConsoleError = console.error;
  const expectedError = new Error('startup failed');
  const exitCodes = [];
  let handledError;

  t.after(() => {
    Module._load = originalLoad;
    process.exit = originalExit;
    console.error = originalConsoleError;
    delete require.cache[indexPath];
  });

  process.exit = (code) => {
    exitCodes.push(code);
  };
  console.error = () => {};

  Module._load = function (request, parent, isMain) {
    if (parent?.filename === indexPath && request === './cli') {
      return {
        parseArgs() {
          throw expectedError;
        }
      };
    }
    if (parent?.filename === indexPath && request === './errors') {
      return {
        handleUnexpectedError(error) {
          handledError = error;
        }
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[indexPath];
  require(indexPath);
  await new Promise((resolve) => setImmediate(resolve));

  assert.strictEqual(handledError, expectedError);
  assert.deepStrictEqual(exitCodes, []);
});
