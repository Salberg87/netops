import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../index.js', import.meta.url));

test('--help lists the core commands', () => {
  const out = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  for (const cmd of ['check', 'dns', 'ping', 'cert', 'report', 'diagnose']) {
    assert.match(out, new RegExp(`\\b${cmd}\\b`));
  }
});

test('--json iface emits parseable JSON on stdout only', () => {
  const out = execFileSync(process.execPath, [cli, '--json', 'iface'], { encoding: 'utf8' });
  const data = JSON.parse(out);
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.interfaces));
});
