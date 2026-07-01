/**
 * Tests for CLI argument parsing.
 */
const test = require('node:test');
const assert = require('node:assert');
const { parseArgs } = require('./cli.js');
const { createTempFile, cleanupTempFiles } = require('../test/helpers/create-temp-file.js');

test('CLI Parser', async (t) => {
  t.afterEach(cleanupTempFiles);

  await t.test('Parses custom rate limit options', () => {
    const filePath = createTempFile(1024, '.txt');
    const config = parseArgs([
      'node',
      'filedrop',
      filePath,
      '--rate-limit-window',
      '2500',
      '--rate-limit-max',
      '7'
    ]);

    assert.strictEqual(config.rateLimitWindow, 2500);
    assert.strictEqual(config.rateLimitMax, 7);
  });
});
