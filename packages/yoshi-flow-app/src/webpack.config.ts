// eslint-disable-next-line import/no-extraneous-dependencies
import webpack from 'webpack';
import {
  validateServerEntry,
  createServerEntries,
} from 'yoshi-common/build/webpack-utils';
import { createBaseWebpackConfig } from 'yoshi-common/build/webpack.config';
import { defaultEntry } from 'yoshi-helpers/build/constants';
import { Config } from 'yoshi-config/build/config';
import {
  isTypescriptProject,
  isSingleEntry,
  inTeamCity,
  isProduction,
} from 'yoshi-helpers/build/queries';
import { SERVER_ENTRY } from 'yoshi-config/build/paths';
import { isObject } from 'lodash';

const useTypeScript = isTypescriptProject();

const createDefaultOptions = (config: Config) => {
  const separateCss =
    config.separateCss === 'prod'
      ? inTeamCity() || isProduction()
      : config.separateCss;

  return {
    name: config.name as string,
    useTypeScript,
    typeCheckTypeScript: useTypeScript,
    useAngular: config.isAngularProject,
    devServerUrl: config.servers.cdn.url,
    separateCss,
  };
};

const defaultSplitChunksConfig = {
  chunks: 'all',
  name: 'commons',
  minChunks: 2,
};

export function createClientWebpackConfig(
  config: Config,
  {
    isDev,
    isHot,
    suricate,
    isAnalyze,
    forceEmitSourceMaps,
  }: {
    isDev?: boolean;
    isHot?: boolean;
    suricate?: boolean;
    isAnalyze?: boolean;
    forceEmitSourceMaps?: boolean;
  } = {},
): webpack.Configuration {
  const entry = config.entry || defaultEntry;

  const defaultOptions = createDefaultOptions(config);

  const clientConfig = createBaseWebpackConfig({
    configName: 'client',
    target: 'web',
    isDev,
    isHot,
    isAnalyze,
    forceEmitSourceMaps,
    exportAsLibraryName: config.exports,
    suricate,
    cssModules: config.cssModules,
    performanceBudget: config.performanceBudget as webpack.PerformanceOptions,
    enhancedTpaStyle: config.enhancedTpaStyle,
    tpaStyle: config.tpaStyle,
    keepFunctionNames: config.keepFunctionNames,
    separateStylableCss: config.enhancedTpaStyle || config.separateStylableCss,
    experimentalRtlCss: config.experimentalRtlCss,
    externalizeRelativeLodash: config.externalizeRelativeLodash,
    createEjsTemplates: config.experimentalBuildHtml,
    useYoshiServer: config.yoshiServer,
    ...defaultOptions,
  });

  clientConfig.entry = isSingleEntry(entry) ? { app: entry as string } : entry;
  clientConfig.resolve!.alias = config.resolveAlias;
  clientConfig.externals = config.externals;

  const useSplitChunks = config.splitChunks;

  if (useSplitChunks) {
    const splitChunksConfig = isObject(useSplitChunks)
      ? useSplitChunks
      : defaultSplitChunksConfig;

    clientConfig!.optimization!.splitChunks = splitChunksConfig as webpack.Options.SplitChunksOptions;
  }

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
    useYoshiServer: config.yoshiServer,
    ...defaultOptions,
  });

  serverConfig.entry = async () => {
    const serverEntry = validateServerEntry({
      extensions: serverConfig.resolve!.extensions as Array<string>,
      yoshiServer: config.yoshiServer,
    });

    let entryConfig = config.yoshiServer
      ? createServerEntries(serverConfig.context as string)
      : {};

    if (serverEntry) {
      entryConfig = { ...entryConfig, [SERVER_ENTRY]: serverEntry };
    }

    return entryConfig;
  };

  return serverConfig;
}

export function createWebWorkerWebpackConfig(
  config: Config,
  { isDev, isHot }: { isDev?: boolean; isHot?: boolean } = {},
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

  workerConfig.entry = config.webWorkerEntry;

  workerConfig.externals = config.webWorkerExternals;

  return workerConfig;
}
