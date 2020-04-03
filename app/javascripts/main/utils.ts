import { CommandLineArgs } from '../shared/CommandLineArgs';

export function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isTesting(): boolean {
  return isDev() && process.argv.includes(CommandLineArgs.Testing);
}
