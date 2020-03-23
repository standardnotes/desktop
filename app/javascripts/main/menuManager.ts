import { StoreKeys, Store } from './store';
import { ArchiveManager } from './archiveManager';
import { UpdateManager } from './updateManager';
import { TrayManager } from './trayManager';
import { SpellcheckerManager } from './spellcheckerManager';
import { MenuItemConstructorOptions, app, Menu, dialog, shell } from 'electron';
import { isMac } from './platforms';
import { appMenu as s } from './strings';

export function createMenuManager({
  window,
  archiveManager,
  updateManager,
  trayManager,
  store,
  spellcheckerManager
}: {
  window: Electron.BrowserWindow;
  archiveManager: ArchiveManager;
  updateManager: UpdateManager;
  trayManager: TrayManager;
  store: Store;
  spellcheckerManager: SpellcheckerManager;
}) {
  let menu: Menu;

  function reload() {
    menu = Menu.buildFromTemplate([
      ...(isMac ? [macAppMenu(app.getName())] : []),
      editMenu(spellcheckerManager, reload),
      viewMenu(window, store, reload),
      windowMenu(store, trayManager, reload),
      backupsMenu(archiveManager, reload),
      updateMenu(updateManager),
      helpMenu(window, shell)
    ]);
    Menu.setApplicationMenu(menu);
  }
  reload() // initialization

  updateManager.onNeedMenuReload = reload;

  return {
    reload,
    popupMenu() {
      if (process.env.NODE_ENV === 'development') {
        /** Check the state */
        if (!menu) throw new Error('called popupMenu() before loading');
      }
      menu?.popup();
    }
  };
}

const enum Roles {
  Undo = 'undo',
  Redo = 'redo',
  Cut = 'cut',
  Copy = 'copy',
  Paste = 'paste',
  PasteAndMatchStyle = 'pasteAndMatchStyle',
  SelectAll = 'selectAll',
  Reload = 'reload',
  ToggleDevTools = 'toggleDevTools',
  ResetZoom = 'resetZoom',
  ZoomIn = 'zoomIn',
  ZoomOut = 'zoomOut',
  ToggleFullScreen = 'togglefullscreen',
  Window = 'window',
  Minimize = 'minimize',
  Close = 'close',
  Help = 'help',
  About = 'about',
  Services = 'services',
  Hide = 'hide',
  HideOthers = 'hideOthers',
  UnHide = 'unhide',
  Quit = 'quit',
  StartSeeking = 'startSpeaking',
  StopSeeking = 'stopSpeaking',
  Zoom = 'zoom',
  Front = 'front'
}

const KeyCombinations = {
  CmdOrCtrlW: 'CmdOrCtrl + W',
  CmdOrCtrlM: 'CmdOrCtrl + M',
  AltM: 'Alt + m'
};

const enum MenuItemTypes {
  CheckBox = 'checkbox',
  Radio = 'radio'
}

const Separator: MenuItemConstructorOptions = {
  type: 'separator'
};

const Urls = {
  Support: 'mailto:help@standardnotes.org',
  Website: 'https://standardnotes.org',
  GitHub: 'https://github.com/standardnotes',
  Slack: 'https://standardnotes.org/slack',
  Twitter: 'https://twitter.com/StandardNotes',
  GitHubReleases: 'https://github.com/standardnotes/desktop/releases'
};

function macAppMenu(appName: string): MenuItemConstructorOptions {
  return {
    label: appName,
    submenu: [
      {
        role: Roles.About
      },
      Separator,
      {
        role: Roles.Services,
        submenu: []
      },
      Separator,
      {
        role: Roles.Hide
      },
      {
        role: Roles.HideOthers
      },
      {
        role: Roles.UnHide
      },
      Separator,
      {
        role: Roles.Quit
      }
    ]
  };
}

function editMenu(
  spellcheckerManager: SpellcheckerManager,
  reload: () => any
): MenuItemConstructorOptions {
  return {
    label: s().edit,
    submenu: [
      {
        role: Roles.Undo
      },
      {
        role: Roles.Redo
      },
      Separator,
      {
        role: Roles.Cut
      },
      {
        role: Roles.Copy
      },
      {
        role: Roles.Paste
      },
      {
        role: Roles.PasteAndMatchStyle
      },
      {
        role: Roles.SelectAll
      },
      ...(isMac
        ? [Separator, macSpeechMenu()]
        : [spellcheckerMenu(spellcheckerManager, reload)])
    ]
  };
}

function macSpeechMenu(): MenuItemConstructorOptions {
  return {
    label: s().speech,
    submenu: [
      {
        role: Roles.StopSeeking
      },
      {
        role: Roles.StopSeeking
      }
    ]
  };
}

function spellcheckerMenu(
  spellcheckerManager: SpellcheckerManager,
  reload: () => any
): MenuItemConstructorOptions {
  return {
    label: s().spellcheckerLanguages,
    submenu: spellcheckerManager.languages().map(
      ({ name, code, enabled }): MenuItemConstructorOptions => {
        return {
          label: name,
          type: MenuItemTypes.CheckBox,
          checked: enabled,
          click: () => {
            if (enabled) {
              spellcheckerManager.removeLanguage(code);
            } else {
              spellcheckerManager.addLanguage(code);
            }
            reload();
          }
        };
      }
    )
  };
}

function viewMenu(
  window: Electron.BrowserWindow,
  store: Store,
  reload: () => any
): MenuItemConstructorOptions {
  return {
    label: s().view,
    submenu: [
      {
        role: Roles.Reload
      },
      {
        role: Roles.ToggleDevTools
      },
      Separator,
      {
        role: Roles.ResetZoom
      },
      {
        role: Roles.ZoomIn
      },
      {
        role: Roles.ZoomOut
      },
      Separator,
      {
        role: Roles.ToggleFullScreen
      },
      ...(isMac ? [] : [Separator, ...menuBarOptions(window, store, reload)])
    ]
  };
}

function menuBarOptions(
  window: Electron.BrowserWindow,
  store: Store,
  reload: () => any
) {
  const useSystemMenuBar = store.get(StoreKeys.UseSystemMenuBar);
  let isMenuBarVisible = store.get(StoreKeys.MenuBarVisible);
  window.setMenuBarVisibility(isMenuBarVisible);
  return [
    {
      visible: !isMac && useSystemMenuBar,
      label: s().hideMenuBar,
      accelerator: KeyCombinations.AltM,
      click: () => {
        isMenuBarVisible = !isMenuBarVisible;
        window.setMenuBarVisibility(isMenuBarVisible);
        store.set(StoreKeys.MenuBarVisible, isMenuBarVisible);
      }
    },
    {
      label: s().useThemedMenuBar,
      type: MenuItemTypes.CheckBox,
      checked: !useSystemMenuBar,
      click: () => {
        store.set(StoreKeys.UseSystemMenuBar, !useSystemMenuBar);
        reload();
        dialog.showMessageBox({
          title: s().preferencesChanged.title,
          message: s().preferencesChanged.message
        });
      }
    }
  ];
}

function windowMenu(store: Store, trayManager: TrayManager, reload: () => any): MenuItemConstructorOptions {
  return {
    role: Roles.Window,
    submenu: [
      {
        role: Roles.Minimize
      },
      {
        role: Roles.Close
      },
      Separator,
      ...(isMac
        ? macWindowItems()
        : [minimizeToTrayItem(store, trayManager, reload)])
    ]
  };
}

function macWindowItems(): MenuItemConstructorOptions[] {
  return [
    {
      label: s().close,
      accelerator: KeyCombinations.CmdOrCtrlW,
      role: Roles.Close
    },
    {
      label: s().minimize,
      accelerator: KeyCombinations.CmdOrCtrlM,
      role: Roles.Minimize
    },
    {
      label: s().zoom,
      role: Roles.Zoom
    },
    Separator,
    {
      label: s().bringAllToFront,
      role: Roles.Front
    }
  ];
}

function minimizeToTrayItem(
  store: Store,
  trayManager: TrayManager,
  reload: () => any
) {
  const minimizeToTray = trayManager.shouldMinimizeToTray();
  return {
    label: s().minimizeToTrayOnClose,
    type: MenuItemTypes.CheckBox,
    checked: minimizeToTray,
    click() {
      store.set(StoreKeys.MinimizeToTray, !minimizeToTray);
      if (trayManager.shouldMinimizeToTray()) {
        trayManager.createTrayIcon();
      } else {
        trayManager.destroyTrayIcon();
      }
      reload();
    }
  };
}

function backupsMenu(archiveManager: ArchiveManager, reload: () => any) {
  return {
    label: s().backups,
    submenu: [
      {
        label: archiveManager.isBackupsEnabled()
          ? s().disableAutomaticBackups
          : s().enableAutomaticBackups,
        click() {
          archiveManager.toggleBackupsStatus();
          reload();
        }
      },
      Separator,
      {
        label: s().changeBackupsLocation,
        click() {
          archiveManager.changeBackupsLocation();
        }
      },
      {
        label: s().openBackupsLocation,
        click() {
          shell.openItem(archiveManager.getBackupsLocation());
        }
      }
    ]
  };
}

function updateMenu(updateManager: UpdateManager) {
  const updateData = updateManager.getMetadata();
  const updateNeeded = updateManager.updateNeeded();
  let label;
  if (updateData.checkingForUpdate) {
    label = s().checkingForUpdate;
  } else if (updateNeeded) {
    label = s().updateAvailable;
  } else {
    label = s().updates;
  }
  const submenu: MenuItemConstructorOptions[] = [];
  const structure = { label, submenu };

  if (updateManager.autoupdateDownloaded()) {
    submenu.push({
      label: s().installPendingUpdate(
        updateManager.autoupdateDownloadedVersion()
      ),
      click() {
        updateManager.installAutoupdateNow();
      }
    });
  }

  submenu.push({
    label: updateManager.autoupdateEnabled()
      ? s().automaticUpdatesEnabled
      : s().automaticUpdatesDisabled,
    click() {
      updateManager.toggleAutoupdateStatus();
    }
  });

  submenu.push(Separator);

  if (updateData.lastCheck && !updateData.checkinForUpdate) {
    submenu.push({
      label: s().lastUpdateCheck(updateData.lastCheck),
      click: () => {}
    });
  }

  if (!updateData.checkinForUpdate) {
    submenu.push({
      label: s().checkForUpdate,
      click: () => {
        updateManager.checkForUpdate({ userTriggered: true });
      }
    });
  }

  submenu.push(Separator);

  submenu.push({
    label: s().yourVersion(updateData.currentVersion),
    click: () => {}
  });

  const latestVersion = updateManager.latestVersion();
  submenu.push({
    label: latestVersion
      ? s().latestVersion(latestVersion)
      : s().errorRetrieving,
    click() {
      updateManager.openChangelog();
    }
  });

  submenu.push(Separator);

  submenu.push({
    label: s().viewReleaseNotes(latestVersion),
    click() {
      updateManager.openChangelog();
    }
  });

  if (updateData.latestDownloaded) {
    submenu.push({
      label: s().openDownloadLocation,
      click() {
        updateManager.openDownloadLocation();
      }
    });
  } else if (updateNeeded || updateData.downloadingUpdate) {
    submenu.push({
      label: updateData.downloadingUpdate
        ? s().downloadingUpdate
        : s().manuallyDownloadUpdate,
      click() {
        updateData.downloadingUpdate
          ? updateManager.openDownloadLocation()
          : updateManager.downloadUpdateFile();
      }
    });
  }

  return structure;
}

function helpMenu(window: Electron.BrowserWindow, shell: Electron.Shell) {
  return {
    role: Roles.Help,
    submenu: [
      {
        label: s().emailSupport,
        click() {
          shell.openExternal(Urls.Support);
        }
      },
      {
        label: s().website,
        click() {
          shell.openExternal(Urls.Website);
        }
      },
      {
        label: s().gitHub,
        click() {
          shell.openExternal(Urls.GitHub);
        }
      },
      {
        label: s().slack,
        click() {
          shell.openExternal(Urls.Slack);
        }
      },
      {
        label: s().twitter,
        click() {
          shell.openExternal(Urls.Twitter);
        }
      },
      Separator,
      {
        label: s().toggleErrorConsole,
        click() {
          window.webContents.toggleDevTools();
        }
      },
      {
        label: s().openDataDirectory,
        click() {
          const userDataPath = app.getPath('userData');
          shell.openItem(userDataPath);
        }
      },
      {
        label: s().clearCacheAndReload,
        async click() {
          await window.webContents.session.clearCache();
          window.reload();
        }
      },
      Separator,
      {
        label: s().version(app.getVersion()),
        click() {
          shell.openExternal(Urls.GitHubReleases);
        }
      }
    ]
  };
}
