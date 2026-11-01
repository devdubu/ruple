import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkDraft, createDraft } from '../contract-drafts.mjs';

function temporaryDrafts(t) {
  const draftRoot = mkdtempSync(path.join(os.tmpdir(), 'ruple-contract-drafts-'));
  t.after(() => rmSync(draftRoot, { recursive: true, force: true }));
  return { draftRoot };
}

test('new drafts cannot silently become public contracts or pass as completed schemas', (t) => {
  const options = temporaryDrafts(t);
  const catalog = readFileSync('contracts/catalog.json', 'utf8');
  const registry = readFileSync('contracts/development/mock-routes.json', 'utf8');
  const directory = createDraft('sample-boundary', options);
  const schema = JSON.parse(readFileSync(path.join(directory, 'schema.json'), 'utf8'));
  assert.equal(schema.$id, 'urn:ruple:contract:sample-boundary:0.1.0');
  assert.ok(checkDraft('sample-boundary', options).length > 0);
  assert.equal(readFileSync('contracts/catalog.json', 'utf8'), catalog);
  assert.equal(readFileSync('contracts/development/mock-routes.json', 'utf8'), registry);
});

test('draft creation refuses path traversal, registered IDs, and existing work', (t) => {
  const options = temporaryDrafts(t);
  for (const id of ['../outside', '/outside', 'UPPER', 'two--hyphens', '', 'a'.repeat(65)]) {
    assert.throws(() => createDraft(id, options));
    assert.throws(() => checkDraft(id, options));
  }
  assert.throws(() => createDraft('platform-http', options));
  const directory = createDraft('sample-boundary', options);
  const file = path.join(directory, 'README.md');
  writeFileSync(file, 'existing developer work');
  assert.throws(() => createDraft('sample-boundary', options));
  assert.equal(readFileSync(file, 'utf8'), 'existing developer work');
});

test('filled drafts validate accepted and rejected consumer inputs before registration', (t) => {
  const options = temporaryDrafts(t);
  const directory = createDraft('sample-boundary', options);
  const schema = { type: 'object', required: ['marker'], properties: { marker: { const: 'synthetic' } }, additionalProperties: false };
  const examples = {
    valid: [{ name: 'synthetic-normal', value: { marker: 'synthetic' } }],
    invalid: [{ name: 'wrong-marker', value: { marker: 'invalid' } }],
  };
  writeFileSync(path.join(directory, 'schema.json'), JSON.stringify(schema));
  writeFileSync(path.join(directory, 'examples.json'), JSON.stringify(examples));
  assert.deepEqual(checkDraft('sample-boundary', options), []);
  examples.valid[0].value = { marker: 'invalid' };
  writeFileSync(path.join(directory, 'examples.json'), JSON.stringify(examples));
  assert.ok(checkDraft('sample-boundary', options).length > 0);
});
