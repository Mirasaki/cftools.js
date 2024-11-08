import { defaultLogTag } from '../resolvers/library';
import { AbstractLogger, LogLevel } from '../types/logger';

export class ConsoleLogger extends AbstractLogger implements AbstractLogger {
  private static instance: ConsoleLogger;

  protected logLevel: LogLevel;
  protected logTag: string;

  private constructor(
    logLevel: LogLevel = 'info',
    logTag = defaultLogTag,
  ) {
    super();
    this.logLevel = logLevel;
    this.logTag = logTag;
  }

  public static getInstance(): ConsoleLogger {
    if (!ConsoleLogger.instance) {
      ConsoleLogger.instance = new ConsoleLogger();
    }
    return ConsoleLogger.instance;
  }

  public info(...args: unknown[]): void {
    if (!this.shouldLog('info')) {
      return;
    }
    console.info(this.formatMessage('info', ...args));
  }

  public warn(...args: unknown[]): void {
    if (!this.shouldLog('warn')) {
      return;
    }
    console.warn(this.formatMessage('warn', ...args));
  }

  public error(...args: unknown[]): void {
    if (!this.shouldLog('error')) {
      return;
    }
    console.error(this.formatMessage('error', ...args));
  }

  public debug(...args: unknown[]): void {
    if (!this.shouldLog('debug')) {
      return;
    }
    console.debug(this.formatMessage('debug', ...args));
  }

  public trace(...args: unknown[]): void {
    if (!this.shouldLog('trace')) {
      return;
    }
    console.trace(this.formatMessage('trace', ...args));
  }

  public fatal(...args: unknown[]): void {
    if (!this.shouldLog('fatal')) {
      return;
    }
    console.error(this.formatMessage('fatal', ...args));
  }
}
