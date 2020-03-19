import log from 'electron-log';
import { createDesktopApplication } from './application';

log.transports.file.level = 'info';

process.on('uncaughtException', err => {
  console.error('Uncaught exception', err);
});

createDesktopApplication();
