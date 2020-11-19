import { app, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import './@types/modules';
import { initializeApplication } from './application';
import { isTesting } from './javascripts/main/utils';
import { setupTesting } from './javascripts/main/testing';
import { CommandLineArgs } from './javascripts/shared/CommandLineArgs';

/** Allow a custom userData path to be used. */
const userDataPathIndex = process.argv.indexOf(CommandLineArgs.UserDataPath);
if (userDataPathIndex > 0) {
  let userDataPath = process.argv[userDataPathIndex + 1];
  if (typeof userDataPath === 'string') {
    userDataPath = path.resolve(userDataPath);

    /** Make sure the path is actually a writeable folder */
    try {
      fs.closeSync(fs.openSync(path.join(userDataPath, 'sn-test-file'), 'w'));
    } catch (e) {
      console.error('Failed to write to provided user data path. Aborting');
      app.exit(1);
    }

    app.setPath('userData', userDataPath);
  }
}

if (isTesting()) {
  setupTesting();
}

log.transports.file.level = 'info';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err);
});

initializeApplication({
  app,
  shell,
  ipcMain,
});
