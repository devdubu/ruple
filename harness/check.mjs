#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();
process.chdir(root);

const stagedOnly = process.argv.includes('--staged');
const failures = [];
const notices = [];
let policy = null;
let files = [];

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function parseJson(file) {
  try {
    return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    failures.push(`${file}: JSON을 읽을 수 없습니다. ${error.message}`);
    return null;
  }
}

policy = parseJson('harness/policy.json');
if (!policy) finish();

for (const file of policy.requiredFiles ?? []) {
  if (!existsSync(path.join(root, file))) {
    failures.push(`${file}: 필수 파일이 없습니다.`);
  }
}

for (const adapter of policy.adapters ?? []) {
  if (!existsSync(path.join(root, adapter))) continue;
  const content = readFileSync(path.join(root, adapter), 'utf8');
  if (!content.includes('RUPLE_HARNESS_ADAPTER_V1')) {
    failures.push(`${adapter}: 하네스 어댑터 표식이 없습니다.`);
  }
  for (const canonical of policy.canonicalDocuments ?? []) {
    if (!content.includes(canonical)) {
      failures.push(`${adapter}: 공통 정본 ${canonical} 연결이 없습니다.`);
    }
  }
}

files = listFiles();
scanSecrets(files);
scanBoundaries(files);
checkCatalog();
checkContractVersions();
finish();

function listFiles() {
  const args = stagedOnly
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '--cached', '--others', '--exclude-standard', '-z'];
  const output = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
  });
  return output
    .split('\0')
    .filter(Boolean)
    .filter((file) => existsSync(path.join(root, file)))
    .filter((file) => statSync(path.join(root, file)).isFile());
}

function readCandidate(file) {
  if (!stagedOnly) return readFileSync(path.join(root, file));
  return execFileSync('git', ['show', `:${file}`], {
    cwd: root,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function isTextFile(file, buffer) {
  if (buffer.includes(0)) return false;
  const extension = path.extname(file).toLowerCase();
  const known = new Set([
    '', '.c', '.cc', '.conf', '.cpp', '.css', '.env', '.go', '.gradle',
    '.graphql', '.h', '.html', '.java', '.js', '.json', '.jsx', '.kt',
    '.kts', '.md', '.mjs', '.properties', '.py', '.rb', '.rs', '.sh',
    '.sql', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
  ]);
  return known.has(extension);
}

function scanSecrets(candidates) {
  const patterns = [
    ['개인키', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
    ['GitHub 토큰', /\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
    ['GitLab 토큰', /\bglpat-[A-Za-z0-9_-]{20,}\b/],
    ['OpenAI 형식 토큰', /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ['Google API 키', /\bAIza[0-9A-Za-z_-]{30,}\b/],
    ['AWS 접근 키', /\bAKIA[0-9A-Z]{16}\b/],
    ['Bearer 토큰', /\bBearer\s+[A-Za-z0-9._~+/=-]{30,}\b/i],
  ];

  for (const file of candidates) {
    const buffer = readCandidate(file);
    if (buffer.length > 2_000_000 || !isTextFile(file, buffer)) continue;
    const lines = buffer.toString('utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const [label, pattern] of patterns) {
        if (pattern.test(line)) {
          failures.push(`${file}:${index + 1}: ${label} 형태가 감지됐습니다.`);
        }
      }
    });
  }
}

function scanBoundaries(candidates) {
  const sourceExtensions = new Set([
    '.c', '.cc', '.cpp', '.go', '.java', '.js', '.jsx', '.kt', '.kts',
    '.mjs', '.py', '.rs', '.ts', '.tsx',
  ]);
  const services = policy.services ?? [];
  const packageTokens = policy.serverPackageTokens ?? {};

  for (const file of candidates) {
    if (!sourceExtensions.has(path.extname(file).toLowerCase())) continue;
    const current = services.find((service) => file.startsWith(`apps/${service.name}/`));
    if (!current) continue;
    const content = readCandidate(file).toString('utf8');

    for (const other of services) {
      if (other.name === current.name) continue;
      const directSource = `apps/${other.name}/src`;
      if (content.includes(directSource)) {
        failures.push(`${file}: ${other.name} 서비스 소스를 직접 참조합니다.`);
      }
    }

    for (const [domain, tokens] of Object.entries(packageTokens)) {
      if (domain === current.domain) continue;
      for (const token of tokens) {
        if (content.includes(token)) {
          failures.push(`${file}: ${domain} 업무 영역의 서버 패키지 ${token}를 직접 참조합니다.`);
        }
      }
    }
  }
}

function checkCatalog() {
  if (!existsSync(path.join(root, 'contracts/catalog.json'))) return;
  const catalog = parseJson('contracts/catalog.json');
  if (!catalog) return;
  if (catalog.formatVersion !== 1) {
    failures.push('contracts/catalog.json: 지원하는 formatVersion은 1입니다.');
  }
  if (!Array.isArray(catalog.contracts) || !Array.isArray(catalog.flows)) {
    failures.push('contracts/catalog.json: contracts와 flows는 배열이어야 합니다.');
    return;
  }

  const ids = new Set();
  for (const contract of catalog.contracts) {
    for (const key of ['id', 'version', 'owner', 'schema', 'example']) {
      if (!contract[key]) failures.push(`contracts/catalog.json: 계약에 ${key} 값이 없습니다.`);
    }
    if (contract.id && ids.has(contract.id)) {
      failures.push(`contracts/catalog.json: 계약 ${contract.id}가 중복됐습니다.`);
    }
    ids.add(contract.id);
    if (contract.version && !/^\d+\.\d+\.\d+$/.test(contract.version)) {
      failures.push(`contracts/catalog.json: ${contract.id} 버전은 주.부.수 형식이어야 합니다.`);
    }
    for (const key of ['schema', 'example']) {
      if (contract[key] && !existsSync(path.join(root, contract[key]))) {
        failures.push(`contracts/catalog.json: ${contract.id}의 ${key} 파일 ${contract[key]}이 없습니다.`);
      }
    }
  }

  for (const flow of catalog.flows) {
    for (const key of ['id', 'status', 'owner', 'document']) {
      if (!flow[key]) failures.push(`contracts/catalog.json: 흐름에 ${key} 값이 없습니다.`);
    }
    if (flow.document && !existsSync(path.join(root, flow.document))) {
      failures.push(`contracts/catalog.json: 흐름 문서 ${flow.document}가 없습니다.`);
    }
  }
}

function checkContractVersions() {
  const base = resolveBase();
  if (!base) {
    notices.push('비교 기준 브랜치가 없어 계약 버전 변경 검사는 생략했습니다.');
    return;
  }

  let before;
  try {
    before = JSON.parse(git(['show', `${base}:contracts/catalog.json`]));
  } catch {
    notices.push(`${base}에 계약 카탈로그가 없어 버전 비교를 생략했습니다.`);
    return;
  }
  const after = parseJson('contracts/catalog.json');
  if (!after) return;

  let changed;
  try {
    changed = new Set(git(['diff', '--name-only', `${base}...HEAD`]).split('\n').filter(Boolean));
  } catch {
    notices.push(`${base}와 현재 커밋의 변경 파일을 비교하지 못했습니다.`);
    return;
  }
  const beforeById = new Map((before.contracts ?? []).map((item) => [item.id, item]));
  for (const contract of after.contracts ?? []) {
    const previous = beforeById.get(contract.id);
    if (!previous) continue;
    const contractFileChanged = [contract.schema, contract.example]
      .filter(Boolean)
      .some((file) => changed.has(file));
    if (contractFileChanged && contract.version === previous.version) {
      failures.push(`계약 ${contract.id}: 스키마 또는 예시가 바뀌었지만 버전 ${contract.version}이 그대로입니다.`);
    }
  }
}

function resolveBase() {
  if (process.env.HARNESS_BASE) return process.env.HARNESS_BASE;
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  return null;
}

function finish() {
  let revision = '커밋 전 상태';
  try {
    revision = git(['rev-parse', '--short', 'HEAD']);
  } catch {
    // 첫 커밋 전 저장소에서도 검사를 계속합니다.
  }
  const mode = stagedOnly ? '스테이징 파일' : '전체 추적·미추적 파일';
  console.log(`[ruple-harness] ${policy?.harnessVersion ?? 'unknown'} | ${mode} | ${revision}`);
  for (const notice of notices) console.log(`참고: ${notice}`);
  if (failures.length > 0) {
    console.error(`실패 ${failures.length}건`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log(`통과: ${files.length}개 파일을 점검했습니다.`);
  process.exit(0);
}
