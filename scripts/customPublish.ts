process.on('unhandledRejection', error => {
  throw error;
});

import execa from 'execa';
import chalk from 'chalk';
import semver from 'semver';
import memoize from 'lodash/memoize';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
// @ts-ignore
import { getPackages } from '@lerna/project';
import { Package } from '../packages/yoshi-flow-monorepo/src/load-package-graph';
import { isTruthy } from '../packages/yoshi-common/src/utils/helpers';

const REGISTRY = 'https://registry.npmjs.org/';
const LATEST_TAG = 'latest';
const NEXT_TAG = 'next';
const OLD_TAG = 'old';

const getPackageDetails = memoize((pkg: Package) => {
  try {
    return JSON.parse(
      execa.sync(`npm show ${pkg.name} --registry=${REGISTRY} --json`, {
        shell: true,
      }).stdout,
    );
  } catch (error) {
    if (error.stderr.toString().includes('npm ERR! code E404')) {
      console.error(
        chalk.red(
          `\nError: package "${pkg.name}" not found. \nPossibly not published yet, please verify that this package is published to npm.\n\nExit with status 1`,
        ),
      );

      // This script will not publish new packages to npm
      process.exit(1);
    }

    throw error;
  }
});

function getPublishedVersions(pkg: Package) {
  return getPackageDetails(pkg).versions || [];
}

function getLatestVersion(pkg: Package) {
  return get(getPackageDetails(pkg), 'dist-tags.latest');
}

function shouldPublishPackage(pkg: Package) {
  const remoteVersionsList = getPublishedVersions(pkg);

  return !remoteVersionsList.includes(pkg.version);
}

function getTag(pkg: Package) {
  const isLessThanLatest = () => semver.lt(pkg.version!, getLatestVersion(pkg));
  const isPreRelease = () => semver.prerelease(pkg.version!) !== null;

  // if the version is less than the version tagged as latest in the registry
  if (isLessThanLatest()) {
    return OLD_TAG;
  }

  // if it's a prerelease use the next tag
  if (isPreRelease()) {
    return NEXT_TAG;
  }

  return LATEST_TAG;
}

function publish(pkg: Package): void {
  const publishCommand = `npm publish ${pkg.location} --tag=${getTag(
    pkg,
  )} --registry=${REGISTRY}`;

  console.log(publishCommand);

  execa.sync(publishCommand, { stdio: 'inherit', shell: true });
}

function prepareForPublish(pkg: Package): Package | undefined {
  if (pkg.private) {
    console.log(`[SKIP]    ${pkg.name} - package is private`);
    return;
  }

  if (!shouldPublishPackage(pkg)) {
    console.log(
      `[SKIP]    ${pkg.name}@${pkg.version} - version exist on registry`,
    );

    return;
  }

  console.log(`[PUBLISH] ${pkg.name}@${pkg.version} - new version detected`);
  return pkg;
}

// Do not try to publish if running on pullrequest CI
if (process.env.agentType === 'pullrequest') {
  console.log('running on pull-request CI');
  console.log('aborting publish...');
  process.exit(0);
}

getPackages(process.cwd()).then((packagesList: Array<Package>) => {
  console.log('> prepare packages for publish');
  console.log();
  const packagesToPublish = packagesList
    .map(prepareForPublish)
    .filter(isTruthy);

  if (!isEmpty(packagesToPublish)) {
    console.log();
    console.log('> start publish packages');
    console.log();
    packagesToPublish.forEach(publish);
  }
});

// Go through lerna's packages, for each package:
// 1. Read package.json
// 2. If the package is private, skip publish
// 3. If the package already exist on the registry, skip publish.
// 4. choose a dist-tag ->
//    * `old` for a release that is less than latest (semver).
//    * `next` for a prerelease (beta/alpha/rc).
//    * `latest` as default.
// 5. perform npm publish using the chosen tag.
