import { PackageJson } from 'read-pkg';
import { Config, InitialConfig } from './config';
import { multipleModules, singleModule } from './globs';

export default (initialConfig: InitialConfig, pkgJson: PackageJson): Config => {
  const {
    name,
    unpkg,
    dependencies = {},
    peerDependencies = {},
    jest = {},
  } = pkgJson;

  const cdnPort = initialConfig.servers?.cdn?.port ?? 3200;
  const cdnSsl = initialConfig.servers?.cdn?.ssl ?? false;
  const cdnUrl =
    initialConfig.servers?.cdn?.url ??
    `${cdnSsl ? 'https:' : 'http:'}//localhost:${cdnPort}/`;

  const clientProjectName = initialConfig.clientProjectName;
  const singleDir = initialConfig.servers?.cdn?.dir ?? singleModule.clientDist;
  const multiDir =
    initialConfig.servers?.cdn?.dir ?? multipleModules.clientDist;

  const clientFilesPath = clientProjectName
    ? `node_modules/${clientProjectName}/${multiDir}`
    : singleDir;

  const config: Config = {
    name: name!,
    unpkg,

    pkgJson,

    servers: {
      cdn: {
        port: cdnPort,
        ssl: cdnSsl,
        url: cdnUrl,
      },
    },

    specs: initialConfig.specs ?? {},
    hooks: initialConfig.hooks ?? {},
    hmr: initialConfig.hmr ?? true,
    liveReload: initialConfig.liveReload ?? true,
    exports: initialConfig.exports,
    entry: initialConfig.entry,
    splitChunks: initialConfig.splitChunks ?? false,
    separateCss: initialConfig.separateCss ?? true,
    cssModules: initialConfig.cssModules ?? true,
    tpaStyle: initialConfig.tpaStyle ?? false,
    enhancedTpaStyle: initialConfig.enhancedTpaStyle ?? false,
    separateStylableCss: initialConfig.separateStylableCss ?? false,
    features: initialConfig.features ?? {},
    externals: initialConfig.externals ?? [],
    transpileTests: initialConfig.transpileTests ?? true,
    externalUnprocessedModules: initialConfig.externalUnprocessedModules ?? [],
    externalizeRelativeLodash:
      initialConfig.features?.externalizeRelativeLodash ?? false,
    petriSpecsConfig: initialConfig.petriSpecs ?? {},
    performanceBudget: initialConfig.performance ?? false,
    resolveAlias: initialConfig.resolveAlias ?? {},
    startUrl: initialConfig.startUrl ?? null,
    keepFunctionNames: initialConfig.keepFunctionNames ?? false,
    umdNamedDefine: initialConfig.umdNamedDefine ?? true,
    experimentalBuildHtml: initialConfig.experimentalBuildHtml ?? false,
    experimentalMonorepo: initialConfig.experimentalMonorepo ?? false,
    experimentalMinimalPRBuild: initialConfig.experimentalBuildHtml ?? false,
    experimentalRtlCss: initialConfig.experimentalRtlCss ?? false,
    experimentalUseAssetRelocator:
      initialConfig.experimentalUseAssetRelocator ?? false,
    yoshiServer: initialConfig.yoshiServer ?? false,
    projectType: initialConfig.projectType ?? null,
    webWorkerEntry: initialConfig.webWorker?.entry,
    webWorkerExternals: initialConfig.webWorker?.externals,
    webWorkerServerEntry: initialConfig.webWorkerServer?.entry,

    jestConfig: jest,

    clientProjectName,
    clientFilesPath,

    isAngularProject: !!dependencies.angular || !!peerDependencies.angular,
    isReactProject: !!dependencies.react || !!peerDependencies.react,
    suricate: initialConfig.suricate ?? false,
    experimentalStorybook: initialConfig.experimentalStorybook ?? false,
  };

  return config;
};
