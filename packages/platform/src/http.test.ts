import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { apiErrorCodes, isErrorEnvelope, parseRuntimeContext } from './http';

const fixtures = JSON.parse(readFileSync('contracts/platform/http-v1.examples.json', 'utf8'));
const schema = JSON.parse(readFileSync('contracts/platform/http-v1.schema.json', 'utf8'));
describe('HTTP consumer compatibility', () => {
  it('recognizes all registered error codes and approved response examples', () => {
    expect([...apiErrorCodes].sort()).toEqual(schema.$defs.error.properties.error.properties.code.enum.toSorted());
    for (const { value } of fixtures.valid) {
      if (value.error) expect(isErrorEnvelope(value)).toBe(true);
      if (value.principal) expect(parseRuntimeContext(value)).toEqual(value);
    }
  });
  it('rejects the canonical malformed responses', () => {
    for (const { value } of fixtures.invalid) {
      expect(isErrorEnvelope(value)).toBe(false);
      expect(() => parseRuntimeContext(value)).toThrow();
    }
  });
});
