const shell = require('electron').shell;
const {app, Menu} = require('electron');
const path = require('path')

class MenuManager {

  reload() {
    this.loadMenu(this.window, this.archiveManager, this.updateManager);
  }

  loadMenu(window, archiveManager, updateManager) {
    this.window = window;
    this.archiveManager = archiveManager;
    this.updateManager = updateManager;

    let updateData = updateManager.getMetadata();

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
          {label: (archiveManager.isBackupsEnabled() ? 'Disable' : 'Enable') + ' Automatic Backups', click: () => {
            archiveManager.toggleBackupsStatus();
            this.reload();
          }},
          {
            type: 'separator'
          },
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

      this.buildUpdateMenu(updateData),

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
            type: 'separator'
          },
          {
            label: "Toggle Error Console",
            click () {
              window.webContents.toggleDevTools();
             }
          },
          {
            label: 'Open Data Directory',
            click () {
              var userDataPath = app.getPath('userData');
              shell.openItem(userDataPath);
             }
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
            type: 'separator'
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

    this.menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(this.menu);
  }

  popupMenu(position) {
    if(this.menu) {
      this.menu.popup(this.window, position.x, position.y);
    }
  }

  buildUpdateMenu(updateData) {
    let updateNeeded = this.updateManager.updateNeeded();
    var label = updateData.checkingForUpdate ? "Checking for update..." : (updateNeeded ? "(1) Update Available" : 'Updates');
    var structure = { label: label };

    var submenu = [];

    if(this.updateManager.autoupdateDownloaded()) {
      submenu.push({
        label: `Install Pending Update (${this.updateManager.autoupdateDownloadedVersion()})`,
        click: () => {
          this.updateManager.installAutoupdateNow();
        }
      })
    }

    submenu.push({
      label: this.updateManager.autoupdateEnabled() ? "Automatic Updates Enabled (Beta)" : "Automatic Updates Disabled",
      click: () => {
        this.updateManager.toggleAutoupdateStatus();
      }
    })

    submenu.push({type: 'separator'});

    if(updateData.lastCheck && !updateData.checkinForUpdate) {
      submenu.push({
        label: `Last checked ${updateData.lastCheck.toLocaleString()}`,
        click() {}
      })
    }

    if(!updateData.checkinForUpdate) {
      submenu.push({
        label: `Check for Update`,
        click: () => { this.updateManager.checkForUpdate({userTriggered: true}); }
      })
    }

    submenu.push({type: 'separator'});

    submenu.push({label: `Your Version: ${updateData.currentVersion}`, click() {

    }})

    let latestVersion = this.updateManager.latestVersion();
    submenu.push({label: `Latest Version: ${latestVersion ? latestVersion : 'Error Retrieving'}`, click: () => {
      this.updateManager.openChangelog();
    }})

    submenu.push({type: 'separator'});

    submenu.push({label: `View ${latestVersion} Release Notes`, click: () => {
      this.updateManager.openChangelog();
    }})

    if(updateData.latestDownloaded) {
      submenu.push({
        label: "Open Download Location",
        click: () => {
          this.updateManager.openDownloadLocation();
        }
      })
    } else if(updateNeeded || updateData.downloadingUpdate) {
      submenu.push({
        label: updateData.downloadingUpdate ? "Downloading update..." : "Manually Download Update",
        click: () => {
          updateData.downloadingUpdate ? this.updateManager.openDownloadLocation() :  this.updateManager.downloadUpdateFile();
        }
      })
    }

    structure.submenu = submenu;
    return structure;
  }
}

export default new MenuManager();
