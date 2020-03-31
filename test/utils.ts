import electronBinary from 'electron';
import { Suite } from 'mocha';
import path from 'path';
import { Application } from 'spectron';
import { CommandLineArgs } from '../app/javascripts/shared/CommandLineArgs';

const TenSeconds = 10000;

export function setDefaults(suite: Suite) {
  suite.timeout(TenSeconds);
}

export async function launchApp({ testing = true } = {}) {
  const app = new Application({
    /**
     * The type definition for `path` is incorrect. We need to pass
     * the electron binary for everything to work.
     */
    path: (electronBinary as unknown) as string,
    args: [
      /**
       * Tells spectron to look for and use the package.json file
       * located 1 level above.
       */
      path.join(__dirname, '..'),
      '--icon',
      '_icon/icon.png',
      ...(testing ? [CommandLineArgs.Testing] : [])
    ]
  });
  await app.start();
  return app;
}
