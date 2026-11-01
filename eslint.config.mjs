import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.venv/**', '**/.nx/**', 'prototypes/**', 'harness/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': ['error', {
        enforceBuildableLibDependency: false,
        allow: [],
        depConstraints: [
          { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:lib'] },
          { sourceTag: 'type:lib', onlyDependOnLibsWithTags: ['type:lib'] },
          { sourceTag: 'scope:context', notDependOnLibsWithTags: ['scope:automation-internal', 'scope:interaction-internal'] },
          { sourceTag: 'scope:automation', notDependOnLibsWithTags: ['scope:context-internal', 'scope:interaction-internal'] },
          { sourceTag: 'scope:interaction', notDependOnLibsWithTags: ['scope:context-internal', 'scope:automation-internal'] },
          { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
          { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['env:browser', 'env:universal'] },
          { sourceTag: 'env:browser', onlyDependOnLibsWithTags: ['env:browser', 'env:universal'] },
          { sourceTag: 'env:universal', onlyDependOnLibsWithTags: ['env:universal'] },
          { sourceTag: 'env:server', onlyDependOnLibsWithTags: ['env:server', 'env:universal'] }
        ]
      }]
    }
  }
);
