import { app, ipcMain, shell } from 'electron';
import log from 'electron-log';
import './@types/modules';
import { initializeApplication } from './application';
import { isTesting } from './javascripts/main/utils';
import { setupTesting } from './javascripts/main/testing';

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
