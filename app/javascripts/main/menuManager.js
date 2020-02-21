import { Store, StoreKeys } from './store';
const { app, Menu, dialog, shell } = require('electron');

export class MenuManager {
  constructor(window, archiveManager, updateManager, trayManager) {
    this.window = window;
    this.archiveManager = archiveManager;
    this.updateManager = updateManager;
    this.trayManager = trayManager;
  }

  reload() {
    this.loadMenu();
  }

  loadMenu() {
    const updateData = this.updateManager.getMetadata();
    const useSystemMenuBar = Store.get(StoreKeys.UseSystemMenuBar);
    const minimizeToTray = this.trayManager.shouldMinimizeToTray();
    let isMenuBarVisible = Store.get(StoreKeys.MenuBarVisible);
    this.window.setMenuBarVisibility(isMenuBarVisible);
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
            type: 'separator'
          },
          {
            visible: process.platform !== 'darwin' && useSystemMenuBar,
            label: 'Hide Menu Bar',
            accelerator: 'Alt + m',
            click: () => {
              isMenuBarVisible = !isMenuBarVisible;
              this.window.setMenuBarVisibility(isMenuBarVisible);
              Store.set(StoreKeys.MenuBarVisible, isMenuBarVisible);
            }
          },
          {
            visible: process.platform !== 'darwin',
            label: 'Use Themed Menu Bar',
            type: 'checkbox',
            checked: !useSystemMenuBar,
            click: () => {
              Store.set(StoreKeys.UseSystemMenuBar, !useSystemMenuBar);
              this.reload();
              dialog.showMessageBox({
                title: 'Preference Changed',
                message: 'Your menu bar preference has been saved. Please restart the application for the change to take effect.'
              });
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
          },
          {
            type: 'separator'
          },
          {
            visible: process.platform !== 'darwin',
            label: 'Minimize To Tray On Close',
            type: 'checkbox',
            checked: minimizeToTray,
            click: () => {
              Store.set(StoreKeys.MinimizeToTray, !minimizeToTray);
              this.reload();
              if (this.trayManager.shouldMinimizeToTray()) {
                this.trayManager.createTrayIcon();
              } else {
                this.trayManager.destroyTrayIcon();
              }
            }
          }
        ]
      },
      {
        label: 'Backups',
        submenu: [
          {
            label: (
                this.archiveManager.isBackupsEnabled() ? 'Disable' : 'Enable'
              ) + ' Automatic Backups',
            click: () => {
              this.archiveManager.toggleBackupsStatus();
              this.reload();
            }
          },
          {
            type: 'separator'
          },
          {
            label: 'Change Backups Location', 
            click: () => {
              this.archiveManager.changeBackupsLocation();
            }
          },
          {
            label: 'Open Backups Location', 
            click: () => {
              shell.openItem(this.archiveManager.getBackupsLocation());
            }
          }
        ]
      },
      this.buildUpdateMenu(updateData),
      {
        role: 'help',
        submenu: [
          {
            label: 'Email Support',
            click: () => { shell.openExternal('mailto:help@standardnotes.org'); }
          },
          {
            label: 'Website',
            click: () => { shell.openExternal('https://standardnotes.org'); }
          },
          {
            label: 'GitHub',
            click: () => { shell.openExternal('https://github.com/standardnotes'); }
          },
          {
            label: 'Slack',
            click: () => { shell.openExternal('https://standardnotes.org/slack'); }
          },
          {
            label: 'Twitter',
            click: () => { shell.openExternal('https://twitter.com/StandardNotes'); }
          },
          {
            type: 'separator'
          },
          {
            label: 'Toggle Error Console',
            click: () => {
              this.window.webContents.toggleDevTools();
            }
          },
          {
            label: 'Open Data Directory',
            click: () => {
              const userDataPath = app.getPath('userData');
              shell.openItem(userDataPath);
            }
          },
          {
            label: 'Clear Cache and Reload',
            click: () => {
              this.window.webContents.session.clearCache(() => {
                this.window.reload();
              });
            }
          },
          {
            type: 'separator'
          },
          {
            label: 'Version: ' + app.getVersion(),
            click: () => { 
              shell.openExternal('https://github.com/standardnotes/desktop/releases');
            }
          }
        ]
      }
    ];

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
      });
      /* Edit menu. */
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
      );
      /* Window menu. */
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
      ];
    }

    this.menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(this.menu);
  }

  popupMenu(position) {
    if (this.menu) {
      this.menu.popup(this.window, position.x, position.y);
    }
  }

  buildUpdateMenu(updateData) {
    const updateNeeded = this.updateManager.updateNeeded();
    const label = updateData.checkingForUpdate 
      ? 'Checking for update...' 
      : (updateNeeded ? '(1) Update Available' : 'Updates');
    const structure = { label: label };
    const submenu = [];

    if (this.updateManager.autoupdateDownloaded()) {
      submenu.push({
        label: `Install Pending Update 
          (${this.updateManager.autoupdateDownloadedVersion()})
        `,
        click: () => {
          this.updateManager.installAutoupdateNow();
        }
      });
    }

    submenu.push({
      label: this.updateManager.autoupdateEnabled() 
        ? 'Automatic Updates Enabled' 
        : 'Automatic Updates Disabled',
      click: () => {
        this.updateManager.toggleAutoupdateStatus();
      }
    });

    submenu.push({ type: 'separator' });

    if (updateData.lastCheck && !updateData.checkinForUpdate) {
      submenu.push({
        label: `Last checked ${updateData.lastCheck.toLocaleString()}`,
        click: () => { }
      });
    }

    if (!updateData.checkinForUpdate) {
      submenu.push({
        label: 'Check for Update',
        click: () => { 
          this.updateManager.checkForUpdate({ userTriggered: true }); 
        }
      });
    }

    submenu.push({ type: 'separator' });

    submenu.push({
      label: `Your Version: ${updateData.currentVersion}`, 
      click: () => {}
    });

    const latestVersion = this.updateManager.latestVersion();
    submenu.push({
      label: `Latest Version: ${latestVersion || 'Error Retrieving'}`, 
      click: () => {
        this.updateManager.openChangelog();
      }
    });

    submenu.push({ type: 'separator' });

    submenu.push({
      label: `View ${latestVersion} Release Notes`, 
      click: () => {
        this.updateManager.openChangelog();
      }
    });

    if (updateData.latestDownloaded) {
      submenu.push({
        label: 'Open Download Location',
        click: () => {
          this.updateManager.openDownloadLocation();
        }
      });
    } else if (updateNeeded || updateData.downloadingUpdate) {
      submenu.push({
        label: updateData.downloadingUpdate 
          ? 'Downloading update...' 
          : 'Manually Download Update',
        click: () => {
          updateData.downloadingUpdate 
            ? this.updateManager.openDownloadLocation() 
            : this.updateManager.downloadUpdateFile();
        }
      });
    }

    structure.submenu = submenu;
    return structure;
  }
}
