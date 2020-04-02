import log from 'electron-log';
import { app, shell, ipcMain } from 'electron';
import { initializeApplication } from './application';
import { Store } from './javascripts/main/store';

log.transports.file.level = 'info';

process.on('uncaughtException', err => {
  console.error('Uncaught exception', err);
});

initializeApplication({
  app,
  shell,
  ipcMain
});
