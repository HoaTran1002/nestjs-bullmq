import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import type pino from 'pino';

type PinoLogger = pino.Logger;

export type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'debug'
  | 'verbose'
  | 'fatal';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class LoggerService extends ConsoleLogger {
  private contextName: string;

  constructor(
    @Inject('PINOLOGGER') private readonly pinoLogger: PinoLogger,
    context?: string,
  ) {
    super(context || 'DefaultLogger');
    this.contextName = context || 'DefaultLogger';
  }

  override setContext(context: string) {
    this.contextName = context;
  }

  override error(message: string, trace?: string, context?: string) {
    const metadata = trace ? { trace } : undefined;
    this.write('error', message, metadata, undefined, context);
  }

  override warn(message: string, context?: string) {
    this.write('warn', message, undefined, undefined, context);
  }

  override log(message: string, context?: string) {
    this.write('info', message, undefined, undefined, context);
  }

  override debug(message: string, context?: string) {
    this.write('debug', message, undefined, undefined, context);
  }

  override verbose(message: string, context?: string) {
    this.write('verbose', message, undefined, undefined, context);
  }

  override fatal(message: string, context?: string) {
    this.write('fatal', message, undefined, undefined, context);
  }

  logWithMeta(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: unknown,
    context?: string,
  ) {
    this.write(level, message, metadata, error, context);
  }

  child(bindings: Record<string, unknown>): LoggerService {
    return new LoggerService(this.pinoLogger.child(bindings), this.contextName);
  }

  private write(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: unknown,
    context?: string,
  ) {
    const resolvedContext = context || this.contextName;
    const payload = { ...metadata, context: resolvedContext };
    const method = this.resolveMethod(level);

    if (error instanceof Error) {
      method({ ...payload, err: error }, message);
      return;
    }

    if (isRecord(error)) {
      method({ ...payload, error }, message);
      return;
    }

    method(payload, message);
  }

  private resolveMethod(level: LogLevel) {
    switch (level) {
      case 'fatal':
        return this.pinoLogger.fatal.bind(this.pinoLogger);
      case 'error':
        return this.pinoLogger.error.bind(this.pinoLogger);
      case 'warn':
        return this.pinoLogger.warn.bind(this.pinoLogger);
      case 'debug':
        return this.pinoLogger.debug.bind(this.pinoLogger);
      case 'verbose':
        return this.pinoLogger.trace.bind(this.pinoLogger);
      default:
        return this.pinoLogger.info.bind(this.pinoLogger);
    }
  }
}
