/**
 * Migration script: JSONL -> D1
 *
 * Converts existing logs.jsonl file to SQL INSERT statements
 * that can be run against your D1 database.
 *
 * Usage:
 *   node scripts/migrate-jsonl-to-d1.js ./app/logs.jsonl > migration-data.sql
 *   wrangler d1 execute project-echo-db --file=./migration-data.sql
 */

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];

if (!inputFile) {
  console.error('Usage: node migrate-jsonl-to-d1.js <path-to-logs.jsonl>');
  process.exit(1);
}

const filePath = path.resolve(inputFile);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const data = fs.readFileSync(filePath, 'utf8');
const lines = data.trim().split('\n').filter(line => line);

console.log('-- Migration from JSONL to D1');
console.log('-- Generated: ' + new Date().toISOString());
console.log('');

for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    const content = entry.content.replace(/'/g, "''"); // Escape single quotes
    const isPrivate = entry.private ? 1 : 0;
    const createdAt = entry.timestamp || new Date().toISOString();

    console.log(
      `INSERT INTO logs (content, is_private, created_at) VALUES ('${content}', ${isPrivate}, '${createdAt}');`
    );
  } catch (e) {
    console.error(`-- Skipping invalid line: ${line}`);
  }
}
