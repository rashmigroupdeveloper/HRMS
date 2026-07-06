/**
 * Module-boundary enforcement — docs/14 §5.
 * This replaces framework-enforced structure (NestJS DI) with machine-checked rules.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make modules untestable and unreadable.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-cross-module-deep-imports',
      severity: 'error',
      comment:
        'Modules talk only through their public API (modules/<x>/index.ts). ' +
        'Deep imports across module boundaries are banned (docs/14 §5).',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/.+',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'core-must-not-depend-on-modules',
      severity: 'error',
      comment: 'core/ is the shared foundation; it must never import from feature modules.',
      from: { path: '^src/core/' },
      to: { path: '^src/modules/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
