import { DesktopApplication } from './application';

DesktopApplication.createSharedApplication();

const log = require('electron-log');
log.transports.file.level = 'info';

process.on('uncaughtException', function (err) {
  console.error('Uncaught exception', err);
});
