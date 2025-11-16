import pino, {
  type Level,
  type Logger,
  type LoggerOptions,
  multistream,
  type StreamEntry,
  type DestinationStream,
} from 'pino';
import { mkdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_LOG_DIR = 'logs';

async function buildConsoleStream(level: Level): Promise<StreamEntry<Level>> {
  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
  const forcePretty = process.env.LOG_PRETTY === 'true';
  if (isProduction && !forcePretty) {
    const stream: DestinationStream = pino.destination({ sync: false });
    return { stream, level } satisfies StreamEntry<Level>;
  }
  try {
    return {
      stream: (await pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          levelFirst: true,
          singleLine: true,
        },
      })) as DestinationStream,
      level,
    } satisfies StreamEntry<Level>;
  } catch {
    const stream: DestinationStream = pino.destination({ sync: false });
    return { stream, level } satisfies StreamEntry<Level>;
  }
}

function buildFileStream(level: Level): StreamEntry<Level> | undefined {
  const logDirEnv = process.env.LOG_DIR;
  const isTest = (process.env.NODE_ENV ?? 'development') === 'test';
  if (logDirEnv === 'false' || isTest) return undefined;
  const baseDirectory =
    logDirEnv && logDirEnv.length > 0
      ? logDirEnv
      : join(process.cwd(), DEFAULT_LOG_DIR);
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const directory = join(baseDirectory, year, month);
  mkdirSync(directory, { recursive: true });
  const logFile = join(directory, `backend-${year}-${month}-${day}.log`);
  const destination: DestinationStream = pino.destination({
    dest: logFile,
    mkdir: true,
    sync: false,
  });
  return { stream: destination, level } satisfies StreamEntry<Level>;
}

export async function createLogger(): Promise<Logger> {
  const env = process.env.NODE_ENV ?? 'development';
  const defaultLevel: Level = env === 'production' ? 'info' : 'debug';
  const level: Level =
    (process.env.LOG_LEVEL as Level | undefined) ?? defaultLevel;
  const options: LoggerOptions = {
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
  };
  const targets: StreamEntry<Level>[] = [];
  if (process.env.LOG_TO_CONSOLE !== 'false') {
    const consoleStream = await buildConsoleStream(level);
    targets.push(consoleStream);
  }
  const fileStream = buildFileStream(level);
  if (fileStream) targets.push(fileStream);
  if (targets.length === 0) return pino(options);
  if (targets.length === 1) return pino(options, targets[0].stream);
  return pino(options, multistream(targets));
}
