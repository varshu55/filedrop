#!/usr/bin/env node

/**
 * filedrop - CLI Entry Point
 */

// Validate Node.js version before loading any modules
const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0], 10);

if (majorVersion < 18) {
  console.error(`\x1b[31mfiledrop: error: Node.js version 18 or higher is required.\x1b[0m`);
  console.error(`You are currently running Node.js ${nodeVersion}.`);
  console.error('Please upgrade Node.js to use this tool.');
  process.exit(1);
}

const { registerGlobalErrorHandlers } = require('../src/errors');
registerGlobalErrorHandlers();

// Load and execute the main orchestrator
require('../src/index.js');
