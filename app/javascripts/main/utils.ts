import { CommandLineArgs } from '../shared/CommandLineArgs';

export function isTesting(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.argv.includes(CommandLineArgs.Testing)
  );
}
