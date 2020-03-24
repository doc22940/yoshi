// eslint-disable-next-line import/no-extraneous-dependencies
import webpack from 'webpack';
import { createBaseWebpackConfig } from 'yoshi-common/build/webpack.config';
import { isSingleEntry } from 'yoshi-helpers/build/queries';
import { Config } from './config/types';

const stripOrganization = (name: string): string =>
  name.slice(name.indexOf('/') + 1);

export function createClientWebpackConfig(
  config: Config,
  {
    isDev,
    isHot,
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
  const entry = config.entry;

  const name = stripOrganization(config.pkgJson.name!);

  const clientConfig = createBaseWebpackConfig({
    name,
    useTypeScript: true,
    typeCheckTypeScript: false,
    devServerUrl: config.url,
    configName: 'client',
    target: 'web',
    isDev,
    isHot,
    isAnalyze,
    forceEmitSourceMaps,
    exportAsLibraryName: config.umd,
    cssModules: true,
    separateCss: true,
  });

  clientConfig.entry = isSingleEntry(entry)
    ? { [stripOrganization(name)]: entry as string }
    : entry;

  clientConfig.externals = config.externals;
  clientConfig.output!.filename = isDev ? '[name].umd.js' : '[name].umd.min.js';

  return clientConfig;
}
