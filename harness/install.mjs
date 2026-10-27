#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: root,
  stdio: 'inherit',
});

console.log('Ruple 로컬 훅을 활성화했습니다: core.hooksPath=.githooks');
