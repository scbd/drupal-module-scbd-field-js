import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('visual harness provides the backing input required by its mounted widget', () => {
  const html = read('../index.html');
  const name = read('../src/main.js').match(/\bname:\s*['"]([^'"]+)['"]/)[1];
  const expected = `field_${name.toLowerCase()}[0][value]`;
  const inputs = html.match(/<input\b[^>]*>/g) || [];
  assert.ok(inputs.some((input) => input.match(/\bname=['"]([^'"]+)['"]/)?.[1] === expected),
    `Missing backing input ${expected}; closing the multiselect would throw`);
});
