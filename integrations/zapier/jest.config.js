/** @type {import('jest').Config} */
module.exports = {
  transform: {
    '\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  transformIgnorePatterns: [
    'node_modules/',
  ],
};
