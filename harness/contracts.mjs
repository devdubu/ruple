import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function validateFixtures(schema, examples) {
  const failures = [];
  try {
    const validate = addFormats(new Ajv2020({ allErrors: true, strict: true })).compile(schema);
    if (!Array.isArray(examples.valid) || !examples.valid.length
      || !Array.isArray(examples.invalid) || !examples.invalid.length) {
      return ['valid and invalid example arrays must both be non-empty'];
    }
    const names = new Set();
    for (const [kind, fixtures] of Object.entries(examples)) {
      if (!['valid', 'invalid'].includes(kind)) { failures.push(`Unknown example group: ${kind}`); continue; }
      for (const fixture of fixtures) {
        if (typeof fixture.name !== 'string' || names.has(fixture.name) || !Object.hasOwn(fixture, 'value')) {
          failures.push('Examples require a unique name and value');
          continue;
        }
        names.add(fixture.name);
        const accepted = validate(fixture.value);
        if (accepted !== (kind === 'valid')) failures.push(`${fixture.name}: expected ${kind} example`);
      }
    }
  } catch (error) {
    failures.push(`Schema/example validation failed: ${error.message}`);
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const catalog = JSON.parse(readFileSync('contracts/catalog.json', 'utf8'));
  const failures = [];
  for (const contract of catalog.contracts) {
    const schema = JSON.parse(readFileSync(contract.schema, 'utf8'));
    const examples = JSON.parse(readFileSync(contract.example, 'utf8'));
    failures.push(...validateFixtures(schema, examples).map((failure) => `${contract.id}: ${failure}`));
  }
  if (failures.length) {
    failures.forEach((failure) => console.error(failure));
    process.exitCode = 1;
  } else console.info(`Contract schemas and examples verified: ${catalog.contracts.length}`);
}
