const shell = require('electron').shell;
const {app, Menu} = require('electron');

class MenuManager {

  loadMenu(window, archiveManager) {
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
            label: 'Hide Menu Bar',
            accelerator: 'Alt + m',
            click() {
              if (window.isMenuBarVisible(true)) {
                window.setMenuBarVisibility(false)
              } else {
                window.setMenuBarVisibility(true)
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
        label: 'Backups',
        submenu: [
          {label: 'Change Backups Location', click() {
            archiveManager.changeBackupsLocation();
          }},
          {label: 'Open Backups Location', click() {
            // Todo: Upgrade to Electron 1.8.1 when it is released to fix issue where opened
            // window is not focused: https://github.com/electron/electron/issues/10477
             shell.openItem(archiveManager.getBackupsLocation());
          }}
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
              window.webContents.session.clearCache(function(){
                window.reload();
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
}

export default new MenuManager();
