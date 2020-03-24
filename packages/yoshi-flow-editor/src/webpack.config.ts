// eslint-disable-next-line import/no-extraneous-dependencies
import webpack from 'webpack';
import { createServerEntries } from 'yoshi-common/build/webpack-utils';
import { createBaseWebpackConfig } from 'yoshi-common/build/webpack.config';
import { Config } from 'yoshi-config/build/config';
import { isTypescriptProject } from 'yoshi-helpers/build/queries';

const useTypeScript = isTypescriptProject();

const createDefaultOptions = (config: Config) => {
  return {
    name: config.name as string,
    useTypeScript,
    typeCheckTypeScript: useTypeScript,
    useAngular: config.isAngularProject,
    devServerUrl: config.servers.cdn.url,
    separateCss: true,
    separateStylableCss: true,
    cssModules: true,
    enhancedTpaStyle: true,
  };
};

export function createClientWebpackConfig(
  config: Config,
  {
    isDev,
    isHot,
    isAnalyze,
    forceEmitSourceMaps,
    customEntry,
  }: {
    isDev?: boolean;
    isHot?: boolean;
    isAnalyze?: boolean;
    forceEmitSourceMaps?: boolean;
    customEntry?: any;
  } = {},
): webpack.Configuration {
  const defaultOptions = createDefaultOptions(config);

  const clientConfig = createBaseWebpackConfig({
    configName: 'client',
    target: 'web',
    isDev,
    isHot,
    isAnalyze,
    forceEmitSourceMaps,
    exportAsLibraryName: '[name]',
    cssModules: config.cssModules,
    ...defaultOptions,
  });

  clientConfig.entry = customEntry;
  clientConfig.resolve!.alias = config.resolveAlias;
  clientConfig.externals = {
    react: {
      amd: 'react',
      umd: 'react',
      commonjs: 'react',
      commonjs2: 'react',
      root: 'React',
    },
    'react-dom': {
      amd: 'reactDOM',
      umd: 'react-dom',
      commonjs: 'react-dom',
      commonjs2: 'react-dom',
      root: 'ReactDOM',
    },
  };

  return clientConfig;
}

export function createServerWebpackConfig(
  config: Config,
  { isDev, isHot }: { isDev?: boolean; isHot?: boolean } = {},
): webpack.Configuration {
  const defaultOptions = createDefaultOptions(config);

  const serverConfig = createBaseWebpackConfig({
    configName: 'server',
    target: 'node',
    isDev,
    isHot,
    ...defaultOptions,
  });

  serverConfig.entry = async () => {
    const serverEntry = '../node_modules/yoshi-flow-editor/build/server/server';

    let entryConfig = config.yoshiServer
      ? createServerEntries(serverConfig.context as string)
      : {};

    entryConfig = { ...entryConfig, server: serverEntry };

    return entryConfig;
  };

  return serverConfig;
}

export function createWebWorkerWebpackConfig(
  config: Config,
  {
    isDev,
    isHot,
    customEntry,
    webWorkerExternals,
  }: {
    isDev?: boolean;
    isHot?: boolean;
    customEntry?: any;
    webWorkerExternals?: any;
  } = {},
): webpack.Configuration {
  const defaultOptions = createDefaultOptions(config);

  const workerConfig = createBaseWebpackConfig({
    configName: 'web-worker',
    target: 'webworker',
    isDev,
    isHot,
    ...defaultOptions,
  });

  workerConfig.output!.library = '[name]';
  workerConfig.output!.libraryTarget = 'umd';
  workerConfig.output!.globalObject = 'self';

  workerConfig.entry = customEntry;

  workerConfig.externals = webWorkerExternals;

  return workerConfig;
}
