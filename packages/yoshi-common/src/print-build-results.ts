import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import filesize from 'filesize';
import { sync as gzipSize } from 'gzip-size';
import webpack from 'webpack';

export type Asset = {
  folder: string;
  name: string;
  size: number;
  gzipSize: number;
};

export function printBundleSizeSuggestion() {
  console.log(chalk.dim('    Interested in reducing your bundle size?'));
  console.log();
  console.log(
    chalk.dim('      > Try https://webpack.js.org/guides/code-splitting'),
  );
  console.log(
    chalk.dim(
      `      > If it's still large, analyze your bundle by running \`npx yoshi build --analyze\``,
    ),
  );
}

export function printClientBuildResult(
  webpackStats: webpack.Stats,
  cwd: string = process.cwd(),
) {
  printStatsResult(prepareAssets(webpackStats, cwd), 'cyan');
}

function printServerBuildResult(
  webpackStats: webpack.Stats,
  cwd: string = process.cwd(),
) {
  printStatsResult(prepareAssets(webpackStats, cwd), 'yellow');
}

export function printBuildResult({
  webpackStats,
  cwd = process.cwd(),
}: {
  webpackStats: [webpack.Stats, webpack.Stats];
  cwd?: string;
}) {
  const [clientStats, serverStats] = webpackStats;

  printClientBuildResult(clientStats, cwd);
  printServerBuildResult(serverStats, cwd);
}

function prepareAssets(
  optimizedStats: webpack.Stats,
  cwd = process.cwd(),
): Array<Asset> {
  const assetsDir = optimizedStats.compilation.outputOptions.path;

  return optimizedStats
    .toJson({ all: false, assets: true })
    .assets!.filter(asset => !asset.name.endsWith('.map'))
    .map(asset => {
      const fileContents = fs.readFileSync(path.join(assetsDir, asset.name));

      return {
        folder: path.join(
          path.relative(cwd, assetsDir),
          path.dirname(asset.name),
        ),
        name: path.basename(asset.name),
        gzipSize: gzipSize(fileContents),
        size: asset.size,
      };
    })
    .sort((a, b) => b.gzipSize - a.gzipSize);
}

function printStatsResult(assets: Array<Asset>, assetNameColor: string) {
  return assets.forEach(asset => {
    console.log(
      '  ' +
        filesize(asset.size) +
        '  ' +
        `(${filesize(asset.gzipSize)} GZIP)` +
        '  ' +
        // @ts-ignore
        `${chalk.dim(asset.folder + path.sep)}${chalk[assetNameColor](
          asset.name,
        )}`,
    );
  });
}
