import { createDesktopApplication } from './application';

createDesktopApplication();

const log = require('electron-log');
log.transports.file.level = 'info';

process.on('uncaughtException', function (err) {
  console.error('Uncaught exception', err);
});
