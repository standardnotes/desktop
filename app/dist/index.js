'use strict';

var _menuManager = require('./javascripts/menuManager.js');

var _menuManager2 = _interopRequireDefault(_menuManager);

var _archiveManager = require('./javascripts/archiveManager.js');

var _archiveManager2 = _interopRequireDefault(_archiveManager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _require = require('electron'),
    app = _require.app,
    Menu = _require.Menu,
    BrowserWindow = _require.BrowserWindow,
    dialog = _require.dialog,
    ipcMain = _require.ipcMain;

app.setName('Standard Notes');

var path = require('path');

var _require2 = require("electron-updater"),
    autoUpdater = _require2.autoUpdater;

var url = require('url');
var windowStateKeeper = require('electron-window-state');
var shell = require('electron').shell;

ipcMain.on('initial-data-loaded', function () {
  _archiveManager2.default.beginBackups();
});

ipcMain.on('major-data-change', function () {
  _archiveManager2.default.performBackup();
});

var isDev = require('electron-is-dev');

var log = require('electron-log');
log.transports.file.level = 'info';

var win = void 0;
var willQuitApp = false;

autoUpdater.on("update-downloaded", function () {
  win.webContents.send("update-available", null);
});

process.on('uncaughtException', function (err) {
  console.log(err);
});

var darwin = process.platform === 'darwin';

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (!darwin) {
    app.quit();
  }
});

function createWindow() {

  // Load the previous state with fallback to defaults
  var winState = windowStateKeeper({
    defaultWidth: 1100,
    defaultHeight: 800
  });

  // Create the window using the state information
  win = new BrowserWindow({
    'x': winState.x,
    'y': winState.y,
    'width': winState.width,
    'height': winState.height,
    'minWidth': 600,
    'minHeight': 400,
    show: false
  });

  _archiveManager2.default.setWindow(win);

  // Register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window
  // is closed) and restore the maximized or full screen state
  winState.manage(win);
  // win.webContents.openDevTools()

  win.on('closed', function (event) {
    win = null;
  });

  win.once('ready-to-show', function () {
    win.show();
  });

  win.on('close', function (e) {
    if (willQuitApp) {
      /* the user tried to quit the app */
      win = null;
    } else if (darwin) {
      /* the user only tried to close the window */
      e.preventDefault();
      win.hide();
    }
  });

  var url = 'file://' + __dirname + '/index.html';
  if ('APP_RELATIVE_PATH' in process.env) {
    url = 'file://' + __dirname + '/' + process.env.APP_RELATIVE_PATH;
  }
  win.loadURL(url);

  // win.webContents.session.clearCache(function(){
  // });

  // handle link clicks
  win.webContents.on('new-window', function (e, url) {
    if (!url.includes("file://")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // handle link clicks (this event is fired instead of
  // 'new-window' when target is not set to _blank)
  win.webContents.on('will-navigate', function (e, url) {
    if (!url.includes("file://")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // auto updater
  autoUpdater.logger = log;
  checkForUpdates();
}

function checkForUpdates() {
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
}

app.on('before-quit', function () {
  return willQuitApp = true;
});

app.on('activate', function () {

  if (!win) {
    createWindow();
  } else {
    win.show();
  }
  checkForUpdates();

  win.webContents.send("window-activated");
});

app.on('ready', function () {

  if (!win) {
    createWindow();
  } else {
    win.focus();
  }

  _menuManager2.default.loadMenu(win, _archiveManager2.default);
});