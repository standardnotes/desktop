const {app, Menu, BrowserWindow, dialog} = require('electron')
app.setName('Standard Notes');

const path = require('path')
const {autoUpdater} = require("electron-updater")
const url = require('url')
const windowStateKeeper = require('electron-window-state')
const shell = require('electron').shell;

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
    autoHideMenuBar: true
  })

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

  win.webContents.send("window-activated")
});

app.on('ready', function(){

  if(!win) {
    createWindow();
  } else {
    win.focus();
  }

  loadMenu();
})


function loadMenu() {

  const template = [
    {
      label: 'Edit',
      submenu: [
        {
          role: 'undo'
        },
        {
          role: 'redo'
        },
        {
          type: 'separator'
        },
        {
          role: 'cut'
        },
        {
          role: 'copy'
        },
        {
          role: 'paste'
        },
        {
          role: 'pasteandmatchstyle'
        },
        {
          role: 'selectall'
        }
      ]
    },

    {
      label: 'View',
      submenu: [
        {
          role: 'reload'
        },
        {
          role: 'toggledevtools'
        },
        {
          type: 'separator'
        },
        {
          role: 'resetzoom'
        },
        {
          role: 'zoomin'
        },
        {
          role: 'zoomout'
        },
        {
          type: 'separator'
        },
        {
          role: 'togglefullscreen'
        },
        {
          visible: process.platform === 'darwin' ? false : true,
          label: 'Toggle Menu Bar',
          type: 'checkbox',
          click() {
            if (win.isMenuBarAutoHide()) {
              win.setAutoHideMenuBar(false)
            } else {
              win.setAutoHideMenuBar(true)
              win.setMenuBarVisibility(false)
            }
          }
        }
      ]
    },
    {
      role: 'window',
      submenu: [
        {
          role: 'minimize'
        },
        {
          role: 'close'
        }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'GitHub',
          click () { shell.openExternal('https://github.com/standardnotes') }
        },
        {
          label: 'Slack',
          click () { shell.openExternal('https://standardnotes.org/slack') }
        },
        {
          label: 'Website',
          click () { shell.openExternal('https://standardnotes.org') }
        },
        {
          label: 'Support',
          click () { shell.openExternal('mailto:hello@standardnotes.org') }
        },
        {
          label: 'Clear Cache and Reload',
          click () {
            win.webContents.session.clearCache(function(){
              win.reload();
            });
           }
        },
        {
          label: 'Version: ' + app.getVersion(),
          click () { shell.openExternal('https://github.com/standardnotes/desktop/releases') }
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          role: 'services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          role: 'hide'
        },
        {
          role: 'hideothers'
        },
        {
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          role: 'quit'
        }
      ]
    })
    // Edit menu.
    template[1].submenu.push(
      {
        type: 'separator'
      },
      {
        label: 'Speech',
        submenu: [
          {
            role: 'startspeaking'
          },
          {
            role: 'stopspeaking'
          }
        ]
      }
    )
    // Window menu.
    template[3].submenu = [
      {
        label: 'Close',
        accelerator: 'CmdOrCtrl+W',
        role: 'close'
      },
      {
        label: 'Minimize',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize'
      },
      {
        label: 'Zoom',
        role: 'zoom'
      },
      {
        type: 'separator'
      },
      {
        label: 'Bring All to Front',
        role: 'front'
      }
    ]
  }

  var menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
