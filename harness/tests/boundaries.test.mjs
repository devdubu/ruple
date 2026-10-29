import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = { ...process.env, NX_DAEMON: 'false', NX_ISOLATE_PLUGINS: 'false' };
const require = createRequire(import.meta.url);
function bin(name) {
  const manifestPath = require.resolve(`${name}/package.json`);
  return path.resolve(path.dirname(manifestPath), require(manifestPath).bin[name]);
}

before(() => {
  execFileSync(process.execPath, [bin('nx'), 'graph', '--file=local-artifacts/boundary-graph.json'], {
    cwd: root, env, stdio: 'pipe', timeout: 60000,
  });
});

function violations(file, source) {
  const result = spawnSync(process.execPath, [
    bin('eslint'), '--stdin', '--stdin-filename', file, '--format=json',
  ], { cwd: root, env, input: source, encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  assert.ok(result.status === 0 || result.status === 1, result.stderr || result.stdout);
  const reports = JSON.parse(result.stdout);
  for (const report of reports) {
    assert.equal(report.fatalErrorCount, 0, JSON.stringify(report.messages));
    for (const message of report.messages) {
      assert.equal(message.ruleId, '@nx/enforce-module-boundaries', JSON.stringify(message));
    }
  }
  return reports.flatMap((report) => report.messages);
}

test('same-domain internals and cross-domain public contracts are allowed', () => {
  assert.deepEqual(violations('apps/context-api/src/app.ts', [
    "import '@ruple/context-server';",
    "import '@ruple/automation-contracts';",
    "import '@ruple/platform';",
  ].join('\n')), []);
});

test('track A cannot import track B server through a package alias', () => {
  assert.ok(violations('apps/context-api/src/app.ts', "import '@ruple/automation-server';").length > 0);
});

test('track B cannot import track A server through a relative path', () => {
  assert.ok(violations('apps/automation-api/src/app.ts', "import '../../../packages/context/server/src/index';").length > 0);
});

test('an application cannot import another application', () => {
  assert.ok(violations('apps/context-api/src/app.ts', "import '../../automation-api/src/app';").length > 0);
});

test('a frontend cannot import even its own domain server', () => {
  assert.ok(violations('packages/context/ui/src/index.tsx', "import '@ruple/context-server';").length > 0);
});

test('a frontend cannot import the common server runtime', () => {
  assert.ok(violations('packages/context/ui/src/index.tsx', "import '@ruple/platform-server';").length > 0);
});

test('shared technical packages cannot depend on a business domain', () => {
  assert.ok(violations('packages/platform/src/index.ts', "import '@ruple/context-contracts';").length > 0);
});

test('server code cannot depend on the browser API client', () => {
  assert.ok(violations('apps/context-api/src/app.ts', "import '@ruple/platform-client';").length > 0);
});
