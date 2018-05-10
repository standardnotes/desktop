const {app, Menu, BrowserWindow, dialog, ipcMain} = require('electron');
app.setName('Standard Notes');

const path = require('path')
const url = require('url')
const windowStateKeeper = require('electron-window-state')
const shell = require('electron').shell;
const log = require('electron-log');

import menuManager from './javascripts/main/menuManager.js'
import archiveManager from './javascripts/main/archiveManager.js';
import packageManager from './javascripts/main/packageManager.js';
import searchManager from './javascripts/main/searchManager.js';
import updateManager from './javascripts/main/updateManager.js';

ipcMain.on('initial-data-loaded', () => {
  archiveManager.beginBackups();
});

ipcMain.on('major-data-change', () => {
  archiveManager.performBackup();
})

process.on('uncaughtException', function (err) {
  console.log(err);
})

log.transports.file.level = 'info';

let darwin = process.platform === 'darwin'
let win, willQuitApp = false;

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

  let iconLocation = path.join(__dirname, '/icon/Icon-512x512.png');

  // Create the window using the state information
  win = new BrowserWindow({
    'x': winState.x,
    'y': winState.y,
    'width': winState.width,
    'height': winState.height,
    'minWidth': 600,
    'minHeight': 400,
    show: false,
    icon: iconLocation,
    titleBarStyle: 'hiddenInset'
  })

  searchManager.setWindow(win);
  archiveManager.setWindow(win);
  packageManager.setWindow(win);
  updateManager.setWindow(win);

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
}

app.on('before-quit', () => willQuitApp = true);

app.on('activate', function() {

	if (!win) {
    createWindow();
	} else {
    win.show();
  }

  updateManager.checkForUpdate();

  win.webContents.send("window-activated");
});

app.on('ready', function(){
  if(!win) {
    createWindow();
  } else {
    win.focus();
  }

  menuManager.loadMenu(win, archiveManager, updateManager);
  updateManager.onNeedMenuReload = () => {
    menuManager.reload();
  }
})
