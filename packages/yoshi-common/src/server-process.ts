import path from 'path';
import stream from 'stream';
import child_process from 'child_process';
import chalk from 'chalk';
import waitPort from 'wait-port';
import fs from 'fs-extra';
import { getDevelopmentEnvVars } from 'yoshi-helpers/build/bootstrap-utils';
import { SERVER_LOG_FILE } from 'yoshi-config/build/paths';
import SocketServer from './socket-server';
import { createSocket as createTunnelSocket } from './utils/suricate';
import { PORT } from './utils/constants';

function serverLogPrefixer() {
  return new stream.Transform({
    transform(chunk, encoding, callback) {
      this.push(`${chalk.greenBright('[SERVER]')}: ${chunk.toString()}`);
      callback();
    },
  });
}

function notUndefined<T>(x: T | undefined): x is T {
  return x !== undefined;
}

const inspectArg = process.argv.find(arg => arg.includes('--debug'));

type ServerProcessEnv = {
  NODE_ENV: 'development' | 'production';
  HMR_PORT?: string;
};

export class ServerProcess {
  private cwd: string;
  private serverFilePath: string;
  private env: ServerProcessEnv;
  public child?: child_process.ChildProcess;
  public appName: string;

  constructor({
    cwd = process.cwd(),
    serverFilePath,
    appName,
    env,
  }: {
    cwd?: string;
    serverFilePath: string;
    appName: string;
    env: ServerProcessEnv;
  }) {
    this.cwd = cwd;
    this.serverFilePath = serverFilePath;
    this.appName = appName;
    this.env = env;
  }

  async initialize() {
    const bootstrapEnvironmentParams = getDevelopmentEnvVars({
      port: PORT,
      cwd: this.cwd,
    });

    const userServerFilePath = path.isAbsolute(this.serverFilePath)
      ? this.serverFilePath
      : path.join(process.cwd(), this.serverFilePath);
    const serverProcessWorker = require.resolve(
      './server-process-worker-with-transpilation.js',
    );

    this.child = child_process.fork(serverProcessWorker, [], {
      stdio: 'pipe',
      execArgv: [inspectArg]
        .filter(notUndefined)
        .map(arg => arg.replace('debug', 'inspect')),
      env: {
        ...process.env,
        PORT: `${PORT}`,
        ...bootstrapEnvironmentParams,
        ...this.env,
        __SERVER_FILE_PATH__: userServerFilePath,
      },
    });

    const serverLogWriteStream = fs.createWriteStream(
      path.join(this.cwd, SERVER_LOG_FILE),
    );
    const serverOutLogStream = this.child.stdout!.pipe(serverLogPrefixer());
    serverOutLogStream.pipe(serverLogWriteStream);
    serverOutLogStream.pipe(process.stdout);

    const serverErrorLogStream = this.child.stderr!.pipe(serverLogPrefixer());
    serverErrorLogStream.pipe(serverLogWriteStream);
    serverErrorLogStream.pipe(process.stderr);

    await waitPort({
      port: PORT,
      output: 'silent',
      timeout: 20000,
    });
  }

  async close() {
    // @ts-ignore
    if (this.child && this.child.exitCode === null) {
      this.child.kill();

      await new Promise(resolve => {
        const check = () => {
          if (this.child && this.child.killed) {
            return resolve();
          }

          setTimeout(check, 100);
        };

        setTimeout(check, 100);
      });
    }
  }

  async restart() {
    await this.close();

    await this.initialize();
  }
}

export class ServerProcessWithHMR extends ServerProcess {
  public socketServer: SocketServer;
  private resolve?: (value?: unknown) => void;
  public suricate: boolean;

  constructor({
    cwd,
    serverFilePath,
    socketServer,
    suricate,
    appName,
  }: {
    cwd: string;
    serverFilePath: string;
    socketServer: SocketServer;
    suricate: boolean;
    appName: string;
  }) {
    super({
      cwd,
      serverFilePath,
      appName,
      env: {
        HMR_PORT: `${socketServer.hmrPort}`,
        NODE_ENV: 'development',
      },
    });

    this.socketServer = socketServer;
    this.suricate = suricate;
  }

  async initialize() {
    if (this.suricate) {
      createTunnelSocket(this.appName, PORT);
    }

    await this.socketServer.initialize();

    this.socketServer.on('message', this.onMessage.bind(this));

    await super.initialize();
  }

  onMessage(response: any) {
    this.resolve && this.resolve(response);
  }

  send(message: any) {
    this.socketServer.send(message);

    return new Promise(resolve => {
      this.resolve = resolve;
    });
  }

  static async create({
    cwd = process.cwd(),
    serverFilePath,
    appName,
    suricate,
  }: {
    cwd?: string;
    serverFilePath: string;
    appName: string;
    suricate: boolean;
  }) {
    const socketServer = await SocketServer.create();

    return new ServerProcessWithHMR({
      socketServer,
      cwd,
      serverFilePath,
      appName,
      suricate,
    });
  }
}
