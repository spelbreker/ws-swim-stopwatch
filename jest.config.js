const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^js-lenex/build/src/lenex-parse$': '<rootDir>/node_modules/js-lenex/build/src/lenex-parse.js',
    '^js-lenex/src/lenex-type$': '<rootDir>/node_modules/js-lenex/build/src/lenex-type.js',
    '^js-lenex/(.*)$': '<rootDir>/node_modules/js-lenex/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(js-lenex)/)'
  ],
  testMatch: [
    '**/test/**/*.test.ts',
    '**/server/**/*.test.ts',
    '**/src/**/*.test.ts'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
