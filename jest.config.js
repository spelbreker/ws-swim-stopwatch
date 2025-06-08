const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  testMatch: [
    '**/test/**/*.test.ts',
    '**/server/**/*.test.ts',
    '**/src/**/*.test.ts'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};