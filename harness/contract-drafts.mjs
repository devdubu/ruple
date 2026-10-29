import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateFixtures } from './contracts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaultDraftRoot = path.join(root, 'contracts/drafts');
const templates = path.join(root, 'contracts/templates');

function draftDirectory(id, draftRoot) {
  if (typeof id !== 'string' || id.length > 64 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error('Contract ID must use lowercase letters, digits, and single hyphens (maximum 64 characters)');
  }
  return path.join(draftRoot, id);
}

export function createDraft(id, { draftRoot = defaultDraftRoot } = {}) {
  const directory = draftDirectory(id, draftRoot);
  const catalog = JSON.parse(readFileSync(path.join(root, 'contracts/catalog.json'), 'utf8'));
  if (catalog.contracts.some((contract) => contract.id === id)) throw new Error('This contract is already registered; use its existing files and version rules');
  mkdirSync(draftRoot, { recursive: true });
  mkdirSync(directory); // Refuse an existing directory, including an empty draft.
  try {
    for (const [source, destination] of [['schema.json', 'schema.json'], ['examples.json', 'examples.json'], ['contract.md', 'README.md']]) {
      const content = readFileSync(path.join(templates, source), 'utf8').replaceAll('{{CONTRACT_ID}}', id);
      writeFileSync(path.join(directory, destination), content, { flag: 'wx', mode: 0o644 });
    }
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  return directory;
}

export function checkDraft(id, { draftRoot = defaultDraftRoot } = {}) {
  const directory = draftDirectory(id, draftRoot);
  const schema = JSON.parse(readFileSync(path.join(directory, 'schema.json'), 'utf8'));
  const examples = JSON.parse(readFileSync(path.join(directory, 'examples.json'), 'utf8'));
  return validateFixtures(schema, examples);
}

export function run(args) {
  if (args.includes('--help')) {
    console.info('pnpm contract:new <contract-id> | pnpm contract:check <contract-id>');
    return;
  }
  const [action, id] = args;
  if (args.length !== 2 || !['new', 'check'].includes(action)) throw new Error('Use contract:new <contract-id> or contract:check <contract-id>');
  if (action === 'new') {
    const directory = createDraft(id);
    console.info(`Created unregistered draft: ${path.relative(root, directory)}`);
    console.info('Fill schema, fixtures, and review notes before contract:check; no public contract or mock route was registered.');
  } else {
    const failures = checkDraft(id);
    if (failures.length) throw new Error(failures.join('\n'));
    console.info(`Draft schema and fixtures verified: ${id}. Review and registration remain separate steps.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { run(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
