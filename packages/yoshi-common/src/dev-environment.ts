import path from 'path';
import webpack from 'webpack';
import createStore, { Store } from 'unistore';
import execa, { ExecaChildProcess } from 'execa';
import formatWebpackMessages from 'react-dev-utils/formatWebpackMessages';
import { prepareUrls, Urls } from 'react-dev-utils/WebpackDevServerUtils';
import debounce from 'lodash/debounce';
import openBrowser from './open-browser';
import { PORT } from './utils/constants';
import { ServerProcessWithHMR } from './server-process';
import { WebpackDevServer, host } from './webpack-dev-server';
import { addEntry, createCompiler } from './webpack-utils';
import { isTruthy } from './utils/helpers';
import {
  getUrl as getTunnelUrl,
  getDevServerSocketPath,
} from './utils/suricate';
import devEnvironmentLogger from './dev-environment-logger';
import { formatTypescriptError } from './typescript/formatter';
import TscProcess, { TscProcessEvent } from './typescript/tsc-process';
import runBabel from './typescript/run-babel';

type WebpackStatus = {
  errors: Array<string>;
  warnings: Array<string>;
};

type StartUrl = string | Array<string> | null | undefined;

export type ProcessState =
  | ({
      status: 'compiling';
    } & Partial<WebpackStatus>)
  | ({
      status: 'success';
      urls?: Urls;
    } & Partial<WebpackStatus>)
  | ({ status: 'errors' } & Partial<WebpackStatus>)
  | ({ status: 'warnings' } & Partial<WebpackStatus>);

export type ProcessType =
  | 'DevServer'
  | 'AppServer'
  | 'Storybook'
  | 'TypeScript';

export type State = {
  [type in ProcessType]?: ProcessState;
};

type DevEnvironmentProps = {
  webpackDevServer?: WebpackDevServer;
  serverProcess?: ServerProcessWithHMR;
  multiCompiler?: webpack.MultiCompiler;
  appName: string;
  suricate: boolean;
  storybookProcess?: ExecaChildProcess;
  tscProcess?: TscProcess;
  startUrl?: StartUrl;
  cwd: string;
};

export default class DevEnvironment {
  private props: DevEnvironmentProps;
  public store: Store<State>;

  constructor(props: DevEnvironmentProps) {
    this.props = props;
    this.store = createStore<State>();

    const {
      multiCompiler,
      webpackDevServer,
      storybookProcess,
      tscProcess,
    } = props;

    if (multiCompiler && webpackDevServer) {
      multiCompiler.hooks.invalid.tap('recompile-log', () => {
        this.store.setState({
          DevServer: {
            status: 'compiling',
          },
        });
      });

      multiCompiler.hooks.done.tap('finished-log', stats => {
        // @ts-ignore
        const messages = formatWebpackMessages(stats.toJson({}, true));
        const isSuccessful =
          !messages.errors.length && !messages.warnings.length;

        if (isSuccessful) {
          const devServerUrls = prepareUrls(
            webpackDevServer.https ? 'https' : 'http',
            host,
            webpackDevServer.port,
          );

          this.store.setState({
            DevServer: {
              status: 'success',
              urls: devServerUrls,
              ...messages,
            },
          });
        } else if (messages.errors.length) {
          if (messages.errors.length > 1) {
            messages.errors.length = 1;
          }

          this.store.setState({
            DevServer: {
              status: 'errors',
              ...messages,
            },
          });
        } else if (messages.warnings.length) {
          this.store.setState({
            DevServer: {
              status: 'warnings',
              ...messages,
            },
          });
        }
      });
    }

    if (storybookProcess) {
      storybookProcess.on('message', this.onStoryBookMessage);
    }

    if (tscProcess) {
      tscProcess.on('message', this.onTscMessage);
    }
  }

  private onStoryBookMessage = (
    message:
      | { type: 'listening'; port: number }
      | { type: 'compiling' }
      | { type: 'finished-log'; stats: any; port: number }
      | { type: 'error'; error: string },
  ) => {
    switch (message.type) {
      case 'error':
        this.store.setState({
          Storybook: { status: 'errors', errors: [message.error] },
        });
        break;
      case 'compiling':
        this.store.setState({
          Storybook: { status: 'compiling', errors: [], warnings: [] },
        });
        break;
      case 'listening':
        openBrowser(`http://localhost:${message.port}`);
        break;
      case 'finished-log':
        // @ts-ignore
        const messages = formatWebpackMessages(message.stats);
        const isSuccessful =
          !messages.errors.length && !messages.warnings.length;
        if (isSuccessful) {
          const urls = prepareUrls('http', host, Number(message.port));
          this.store.setState({
            Storybook: { status: 'success', urls, ...messages },
          });
        } else if (messages.errors.length) {
          if (messages.errors.length > 1) {
            messages.errors.length = 1;
          }
          this.store.setState({
            Storybook: {
              status: 'errors',
              ...messages,
            },
          });
        } else if (messages.warnings.length) {
          this.store.setState({
            Storybook: {
              status: 'warnings',
              ...messages,
            },
          });
        }
        break;
    }
  };

  private onTscMessage = (message: TscProcessEvent) => {
    switch (message.type) {
      // in case there is an error with tsc
      case 'error':
        throw new Error(message.error);
      case 'compiling':
        this.store.setState({
          TypeScript: { status: 'compiling' },
        });
        break;
      case 'compile-successfully':
        this.store.setState({
          TypeScript: { status: 'success' },
        });
        break;
      case 'compile-with-errors':
        this.store.setState({
          TypeScript: {
            status: 'errors',
            errors: message.errors.map(error => formatTypescriptError(error)),
          },
        });
        break;
    }
  };

  private async triggerBrowserRefresh(jsonStats: webpack.Stats.ToJsonOutput) {
    const { webpackDevServer } = this.props;
    if (webpackDevServer) {
      await webpackDevServer.send('hash', jsonStats.hash);
      await webpackDevServer.send('ok', {});
    }
  }

  private async showErrorsOnBrowser(jsonStats: webpack.Stats.ToJsonOutput) {
    const { webpackDevServer } = this.props;

    if (webpackDevServer) {
      if (jsonStats.errors.length > 0) {
        await webpackDevServer.send('errors', jsonStats.errors);
      } else if (jsonStats.warnings.length > 0) {
        await webpackDevServer.send('warnings', jsonStats.warnings);
      }
    }
  }

  startWebWorkerHotUpdate(compiler: webpack.Compiler) {
    compiler.watch({}, async (error, stats) => {
      // We save the result of this build to webpack-dev-server's internal state so the last
      // server build results are sent to the browser on every refresh
      //
      // https://github.com/webpack/webpack-dev-server/blob/master/lib/Server.js#L144
      // @ts-ignore
      this._stats = stats;

      const jsonStats = stats.toJson();

      if (!error && !stats.hasErrors()) {
        await this.triggerBrowserRefresh(jsonStats);
      } else {
        await this.showErrorsOnBrowser(jsonStats);
      }
    });
  }

  startServerHotUpdate(compiler: webpack.Compiler) {
    const { serverProcess } = this.props;

    compiler.watch({}, async (error, stats) => {
      // We save the result of this build to webpack-dev-server's internal state so the last
      // server build results are sent to the browser on every refresh
      //
      // https://github.com/webpack/webpack-dev-server/blob/master/lib/Server.js#L144
      // @ts-ignore
      this._stats = stats;
      const jsonStats = stats.toJson();

      // If the spawned server process has died, restart it
      if (
        serverProcess?.child &&
        // @ts-ignore
        serverProcess.child.exitCode !== null
      ) {
        await serverProcess.restart();
        await this.triggerBrowserRefresh(jsonStats);
      }
      // If it's alive, send it a message to trigger HMR
      else {
        // If there are no errors and the server can be refreshed
        // then send it a signal and wait for a responsne
        if (serverProcess?.child && !error && !stats.hasErrors()) {
          const { success } = (await serverProcess.send({})) as {
            success: boolean;
          };

          // HMR wasn't successful, restart the server process
          if (!success) {
            await serverProcess.restart();
          }

          await this.triggerBrowserRefresh(jsonStats);
        } else {
          await this.showErrorsOnBrowser(jsonStats);
        }
      }
    });
  }

  async start() {
    const {
      multiCompiler,
      webpackDevServer,
      serverProcess,
      suricate,
      appName,
      startUrl,
      tscProcess,
      cwd,
    } = this.props;

    if (tscProcess) {
      tscProcess.watch();

      runBabel({
        watch: true,
        cwd,
      });
    }

    if (multiCompiler && webpackDevServer) {
      const compilationPromise = new Promise(resolve => {
        multiCompiler.hooks.done.tap('done', resolve);
      });

      // Start Webpack compilation
      await webpackDevServer.listenPromise();
      await compilationPromise;
    }

    // start app server if exists
    if (serverProcess) {
      await serverProcess.initialize();

      const serverUrls = prepareUrls('http', host, PORT);

      this.store.setState({
        AppServer: {
          status: 'success',
          urls: serverUrls,
        },
      });

      const actualStartUrl = suricate
        ? getTunnelUrl(appName)
        : startUrl || 'http://localhost:3000';

      openBrowser(actualStartUrl);
    }
  }

  static async create({
    webpackConfigs,
    serverFilePath,
    https,
    webpackDevServerPort,
    enableClientHotUpdates,
    cwd = process.cwd(),
    createEjsTemplates = false,
    appName,
    startUrl,
    suricate = false,
    storybook = false,
    compileTypeScriptFiles = false,
  }: {
    webpackConfigs: [
      webpack.Configuration?,
      webpack.Configuration?,
      webpack.Configuration?,
      webpack.Configuration?,
    ];
    serverFilePath?: string;
    https: boolean;
    webpackDevServerPort: number;
    enableClientHotUpdates: boolean;
    cwd?: string;
    createEjsTemplates?: boolean;
    appName: string;
    startUrl?: StartUrl;
    suricate?: boolean;
    storybook?: boolean;
    compileTypeScriptFiles?: boolean;
  }): Promise<DevEnvironment> {
    const [clientConfig, serverConfig] = webpackConfigs;

    let serverProcess;

    if (serverFilePath) {
      serverProcess = await ServerProcessWithHMR.create({
        serverFilePath,
        cwd,
        suricate,
        appName,
      });

      if (serverProcess && serverConfig) {
        if (!serverConfig.entry) {
          throw new Error('server webpack config was created without an entry');
        }

        // Add server hot entry
        serverConfig.entry = addEntry(serverConfig.entry, [
          `${require.resolve('./utils/server-hot-client')}?${
            serverProcess.socketServer.hmrPort
          }`,
        ]);
      }
    }

    let publicPath: string | undefined;

    if (clientConfig) {
      publicPath = clientConfig.output!.publicPath!;

      // Add client hot entries
      if (enableClientHotUpdates) {
        if (!clientConfig.entry) {
          throw new Error('client webpack config was created without an entry');
        }

        const hmrSocketPath = suricate
          ? getDevServerSocketPath(appName)
          : publicPath;

        const hotEntries = [
          require.resolve('webpack/hot/dev-server'),
          // Adding the query param with the CDN URL allows HMR when working with a production site
          // because the bundle is requested from "parastorage" we need to specify to open the socket to localhost
          `${require.resolve('webpack-dev-server/client')}?${hmrSocketPath}`,
        ];

        // Add hot entries as a separate entry if using experimental build html
        if (createEjsTemplates) {
          clientConfig.entry = {
            // @ts-ignore
            ...clientConfig.entry,
            hot: hotEntries,
          };
        } else {
          clientConfig.entry = addEntry(clientConfig.entry, hotEntries);
        }
      }
    }

    let multiCompiler: webpack.MultiCompiler | undefined;
    let clientCompiler: webpack.Compiler | undefined;
    let serverCompiler: webpack.Compiler | undefined;
    let webWorkerCompiler: webpack.Compiler | undefined;
    let webWorkerServerCompiler: webpack.Compiler | undefined;

    if (webpackConfigs.length > 0) {
      multiCompiler = createCompiler(webpackConfigs.filter(isTruthy));

      clientCompiler = multiCompiler.compilers[0];
      serverCompiler = multiCompiler.compilers[1];
      webWorkerCompiler = multiCompiler.compilers[2];
      webWorkerServerCompiler = multiCompiler.compilers[3];
    }

    let webpackDevServer;

    if (clientCompiler) {
      webpackDevServer = new WebpackDevServer(clientCompiler, {
        publicPath: publicPath!, // we have public path if we have clientCompiler
        https,
        port: webpackDevServerPort,
        appName,
        suricate,
        cwd,
      });
    }

    let storybookProcess;

    if (storybook) {
      const pathToStorybookWorker = path.join(
        __dirname,
        'storybook',
        'storybook-worker',
      );

      // TODO: This line starts storybook
      // This should be refactored and be moved to start method
      storybookProcess = execa.node(pathToStorybookWorker);
    }

    let tscProcess: TscProcess | undefined;

    if (compileTypeScriptFiles) {
      tscProcess = new TscProcess({ cwd });
    }

    const devEnvironment = new DevEnvironment({
      webpackDevServer,
      serverProcess,
      multiCompiler,
      appName,
      suricate,
      startUrl,
      tscProcess,
      storybookProcess,
      cwd,
    });

    if (serverCompiler) {
      devEnvironment.startServerHotUpdate(serverCompiler);
    }

    if (webWorkerCompiler) {
      devEnvironment.startWebWorkerHotUpdate(webWorkerCompiler);
    }

    if (webWorkerServerCompiler) {
      devEnvironment.startWebWorkerHotUpdate(webWorkerServerCompiler);
    }

    devEnvironment.store.subscribe(
      debounce(
        (state: State) => devEnvironmentLogger({ state, appName, suricate }),
        300,
      ),
    );

    return devEnvironment;
  }
}
