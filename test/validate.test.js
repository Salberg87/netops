import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidHost, toBoundedInt } from '../lib/validate.js';
import { ping } from '../lib/ping.js';

test('accepts hostnames and IP literals', () => {
  for (const h of ['example.com', 'sub.example.co.uk', '8.8.8.8', '::1', 'fe80::1%en0', 'localhost']) {
    assert.ok(isValidHost(h), h);
  }
});

test('rejects shell metacharacters and flags', () => {
  for (const h of ['a;id', '$(id)', 'a b', '`id`', '-c1', 'a|b', 'a&&b', '', 'x'.repeat(300), undefined]) {
    assert.ok(!isValidHost(h), String(h));
  }
});

test('bounds integers', () => {
  assert.equal(toBoundedInt('5', { min: 1, max: 10, fallback: 4 }), 5);
  assert.equal(toBoundedInt('999', { min: 1, max: 10, fallback: 4 }), 10);
  assert.equal(toBoundedInt('nope', { min: 1, max: 10, fallback: 4 }), 4);
});

test('ping refuses an injected host without running anything', async () => {
  const r = await ping('example.com;touch /tmp/pwned', 1);
  assert.equal(r.success, false);
  assert.match(r.error, /Invalid host/);
});
