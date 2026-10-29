import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateFixtures } from '../contracts.mjs';

const schema = { type: 'object', required: ['value'], properties: { value: { type: 'string' } }, additionalProperties: false };
test('contract example checks accept correct normal and negative fixtures', () => {
  assert.deepEqual(validateFixtures(schema, {
    valid: [{ name: 'normal', value: { value: 'example' } }],
    invalid: [{ name: 'wrong-type', value: { value: 1 } }],
  }), []);
});
test('contract checks reject both invalid normal fixtures and accidentally valid negative fixtures', () => {
  const failures = validateFixtures(schema, {
    valid: [{ name: 'broken-normal', value: {} }],
    invalid: [{ name: 'broken-negative', value: { value: 'example' } }],
  });
  assert.equal(failures.length, 2);
});
test('contract checks require invalid examples and reject invalid schemas', () => {
  assert.ok(validateFixtures(schema, { valid: [], invalid: [] }).length > 0);
  assert.ok(validateFixtures({ type: 'invalid-schema-type' }, {}).length > 0);
});
