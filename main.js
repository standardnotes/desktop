const {app, Menu, BrowserWindow} = require('electron')
const path = require('path')
// const server = require("./server");

const url = require('url')
const Config = require('electron-config')
const config = new Config()

app.setName('Standard Notes');

let win
let willQuitApp = false;

function createWindow () {

  let opts = {
    width: 900, height: 600,
    minWidth: 900, minHeight: 600,
    icon: __dirname + 'icon.png'
  }
  Object.assign(opts, config.get('winBounds'))
  win = new BrowserWindow(opts)
  
  // win.webContents.openDevTools()

  win.on('closed', (event) => {
    win = null
  })

  win.on('close', (e) => {
    config.set('winBounds', win.getBounds())

    if (willQuitApp) {
      /* the user tried to quit the app */
      win = null;
    } else {
      /* the user only tried to close the window */
      e.preventDefault();
      win.hide();
    }
  })

  win.webContents.session.clearCache(function(){
    win.loadURL('file://' + __dirname + '/app/index.html');
  });
}

app.on('before-quit', () => willQuitApp = true);

app.on('activate', function() {
	if (!win) {
    createWindow();
	} else {
    win.show();
  }
});

app.on('ready', function(){

  if(!win) {
    createWindow();
  } else {
    win.focus();
  }

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
          role: 'delete'
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
          label: 'Github',
          click () { require('electron').shell.openExternal('https://github.com/standardnotes') }
        },
        {
          label: 'Slack',
          click () { require('electron').shell.openExternal('https://slackin-ekhdyygaer.now.sh/') }
        },
        {
          label: 'Website',
          click () { require('electron').shell.openExternal('https://standardnotes.org') }
        },
        {
          label: 'Support',
          click () { require('electron').shell.openExternal('mailto:standardnotes@bitar.io') }
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

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
})
