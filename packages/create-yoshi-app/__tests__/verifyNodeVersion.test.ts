import path from 'path';
import fs from 'fs';
import semver from 'semver';
import chalk from 'chalk';
import verifyNodeVersion from '../src/verifyNodeVersion';

const originalNodeVersion = process.version;

const setNodeVersion = (version: string) => {
  Object.defineProperty(process, 'version', {
    value: `v${version}`,
  });
};

const readNvmrc = (dir: string) =>
  fs
    .readFileSync(path.join(dir, '.nvmrc'))
    .toString()
    .trim();

const nvmrc = readNvmrc(path.resolve(__dirname, '..'));

let exitSpy: jest.SpyInstance, logSpy: jest.SpyInstance;

beforeEach(() => {
  exitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation(() => undefined as never);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  chalk.enabled = false;
});

afterEach(() => {
  setNodeVersion(originalNodeVersion);
  exitSpy.mockRestore();
  logSpy.mockRestore();
  chalk.enabled = true;
});

test('should match node version successfully against .nvmrc file', () => {
  setNodeVersion(semver.minVersion(nvmrc)!.version);
  verifyNodeVersion();
  expect(exitSpy).not.toHaveBeenCalled();
});

test('should fail if node version mismatched', () => {
  setNodeVersion('0.0.0');
  verifyNodeVersion();
  expect(exitSpy).toHaveBeenCalledWith(1);
  expect(logSpy).toHaveBeenCalledWith(
    `Node version v0.0.0 does not match required version of ${nvmrc}\n`,
  );
  expect(logSpy).toHaveBeenCalledWith('Aborting...');
});
