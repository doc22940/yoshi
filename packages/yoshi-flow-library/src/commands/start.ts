import path from 'path';
import arg from 'arg';
import fs from 'fs-extra';
import DevEnvironment from 'yoshi-common/build/dev-environment';
import { TARGET_DIR, BUILD_DIR } from 'yoshi-config/build/paths';
// eslint-disable-next-line import/no-extraneous-dependencies
import webpack from 'webpack';
import { cliCommand } from '../cli';
import { createClientWebpackConfig } from '../webpack.config';

const join = (...dirs: Array<string>) => path.join(process.cwd(), ...dirs);

const start: cliCommand = async function(argv, config) {
  const args = arg(
    {
      // Types
      '--help': Boolean,
      '--production': Boolean,
    },
    { argv },
  );

  const { '--help': help, '--production': shouldRunAsProduction } = args;

  if (help) {
    console.log(
      `
      Description
        Starts the application in development mode

      Usage
        $ yoshi-library start

      Options
        --help, -h      Displays this message
        --production    Start using unminified production build
    `,
    );

    process.exit(0);
  }

  if (shouldRunAsProduction) {
    process.env.BABEL_ENV = 'production';
    process.env.NODE_ENV = 'production';
  }

  await Promise.all([
    fs.emptyDir(join(BUILD_DIR)),
    fs.emptyDir(join(TARGET_DIR)),
  ]);

  const webpackConfigs = [];

  if (config.bundle) {
    const clientConfig = createClientWebpackConfig(config, {
      isDev: true,
      isHot: false,
    });

    webpackConfigs.push(clientConfig);
  }

  const devEnvironment = await DevEnvironment.create({
    webpackConfigs: webpackConfigs as [webpack.Configuration?],
    webpackDevServerPort: config.port,
    https: false,
    appName: config.pkgJson.name!,
    enableClientHotUpdates: false,
    compileTypeScriptFiles: true,
    // storybook: config.storybook,
  });

  await devEnvironment.start();
};

export default start;
