const {app, Menu, BrowserWindow, dialog, ipcMain} = require('electron');
app.setName('Standard Notes');

const path = require('path')
const {autoUpdater} = require("electron-updater")
const url = require('url')
const windowStateKeeper = require('electron-window-state')
const shell = require('electron').shell;

import menuManager from './javascripts/menuManager.js'
import archiveManager from './javascripts/archiveManager.js';

ipcMain.on('initial-data-loaded', () => {
  archiveManager.beginBackups();
});

ipcMain.on('major-data-change', () => {
  archiveManager.performBackup();
})

const isDev = require('electron-is-dev');

const log = require('electron-log')
log.transports.file.level = 'info';

let win;
let willQuitApp = false;

autoUpdater.on("update-downloaded", function() {
  win.webContents.send("update-available", null);
})

process.on('uncaughtException', function (err) {
  console.log(err);
})

let darwin = process.platform === 'darwin'

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (!darwin) {
    app.quit()
  }
})

function createWindow () {

  // Load the previous state with fallback to defaults
  let winState = windowStateKeeper({
    defaultWidth: 1100,
    defaultHeight: 800
  })

  // Create the window using the state information
  win = new BrowserWindow({
    'x': winState.x,
    'y': winState.y,
    'width': winState.width,
    'height': winState.height,
    'minWidth': 600,
    'minHeight': 400,
    show: false,
  })

  archiveManager.setWindow(win);

  // Register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window
  // is closed) and restore the maximized or full screen state
  winState.manage(win)
  // win.webContents.openDevTools()

  win.on('closed', (event) => {
    win = null
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  win.on('close', (e) => {
    if (willQuitApp) {
      /* the user tried to quit the app */
      win = null;
    } else if(darwin) {
      /* the user only tried to close the window */
      e.preventDefault();
      win.hide();
    }
  })

  let url = 'file://' + __dirname + '/index.html';
  if ('APP_RELATIVE_PATH' in process.env) {
    url = 'file://' + __dirname + '/' + process.env.APP_RELATIVE_PATH;
  }
  win.loadURL(url);

  // win.webContents.session.clearCache(function(){
  // });

  // handle link clicks
  win.webContents.on('new-window', function(e, url) {
    if(!url.includes("file://")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // handle link clicks (this event is fired instead of
  // 'new-window' when target is not set to _blank)
  win.webContents.on('will-navigate', function(e, url) {
    if(!url.includes("file://")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // auto updater
  autoUpdater.logger = log
  checkForUpdates();
}

function checkForUpdates() {
  if(!isDev) {
    autoUpdater.checkForUpdates();
  }
}

app.on('before-quit', () => willQuitApp = true);

app.on('activate', function() {

	if (!win) {
    createWindow();
	} else {
    win.show();
  }
  checkForUpdates()

  win.webContents.send("window-activated");
});

app.on('ready', function(){

  if(!win) {
    createWindow();
  } else {
    win.focus();
  }

  menuManager.loadMenu(win, archiveManager);
})
