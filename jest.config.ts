import type {Config} from '@jest/types';
// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  transform: {
    '^.+\\.ts?$': ['ts-jest', { isolatedModules: true }],
  },
  testRegex: "(/__tests__/.*|\\.(test|spec))\\.[jt]sx?$",
  preset: 'ts-jest',
  testEnvironment: 'node',
  bail: true,
  testPathIgnorePatterns: ["dist"],
};
export default config;