import { CommandLineArgs } from '../shared/CommandLineArgs';

export function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isTesting(): boolean {
  return isDev() && process.argv.includes(CommandLineArgs.Testing);
}

export function ensureIsBoolean(arg: any, fallbackValue: boolean): boolean {
  if (typeof arg === 'boolean') {
    return arg;
  }
  return fallbackValue;
}

export function stringOrNull(arg: any): string | null {
  if (typeof arg === 'string') {
    return arg;
  }
  return null;
}
