// src/room-code.js
"use strict";
const crypto = require("crypto");

// Unambiguous alphabet: I/L/O/0/1 removed to avoid confusion
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 32 chars (power of 2 → zero modulo bias)
const CODE_LENGTH = 6;

/**
 * Generates a cryptographically random 6-character room code.
 * @returns {string}
 */
function generateRoomCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

module.exports = { generateRoomCode, ALPHABET, CODE_LENGTH };
