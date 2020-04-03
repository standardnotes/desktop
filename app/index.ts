import { app, ipcMain, shell } from 'electron';
import log from 'electron-log';
import { initializeApplication } from './application';

log.transports.file.level = 'info';

process.on('uncaughtException', err => {
  console.error('Uncaught exception', err);
});

initializeApplication({
  app,
  shell,
  ipcMain
});
