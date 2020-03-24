import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { isEqual } from 'lodash';
import { LoadGraphResult } from './load-package-graph';

export default async function verifyTypeScriptReferences({
  graph,
}: LoadGraphResult): Promise<void> {
  await Promise.all(
    Array.from(graph).map(async ([, pkg]) => {
      const tsconfigPath = path.join(pkg.location, 'tsconfig.json');
      const tsconfig = await fs.readJSON(tsconfigPath);
      const references = Array.from(pkg.localDependencies)
        .map(([depName]) => {
          return path.relative(pkg.location, graph.get(depName)!.location);
        })
        .map(relativePath => ({ path: relativePath }));

      const clonedTsconfig = { ...tsconfig, references };
      // Don't write empty references
      if (clonedTsconfig.references.length === 0) {
        delete clonedTsconfig.references;
      }

      // Only update `tsconfig` and show a message if an update is needed
      if (!isEqual(clonedTsconfig, tsconfig)) {
        console.log(
          chalk.bold(
            `Changes have been made to the references of ${chalk.cyan(
              path.relative(process.cwd(), tsconfigPath),
            )}.`,
          ),
        );

        await fs.writeFile(
          tsconfigPath,
          JSON.stringify(clonedTsconfig, null, 2).replace(/\n/g, os.EOL) +
            os.EOL,
        );
      }
    }),
  );

  console.log();
}
