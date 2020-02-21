import {
  ArchiveManager,
  createExtensionsServer,
  MenuManager,
  initializePackageManager,
  SearchManager,
  createTrayManager,
  UpdateManager,
  ZoomManager
} from './javascripts/main';
import { Store, StoreKeys } from './javascripts/main/store';
import { AppName } from './javascripts/main/strings';
import { IpcMessages } from './javascripts/shared/ipcMessages';
import index from './index.html';

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

const WINDOW_DEFAULT_WIDTH = 1100;
const WINDOW_DEFAULT_HEIGHT = 800;
const WINDOW_MIN_WIDTH = 300;
const WINDOW_MIN_HEIGHT = 400;

export const Platforms = {
  Mac: 1,
  Windows: 2,
  Linux: 3
};

function determinePlatform(platform) {
  switch (platform) {
    case 'darwin':
      return Platforms.Mac;
    case 'win32':
      return Platforms.Windows;
    case 'linux':
      return Platforms.Linux;
    default:
      throw `Unknown platform: ${platform}.`;
  }
}

class DesktopApplication {
  constructor() {
    app.setName(AppName);
    this.platform = determinePlatform(process.platform);
    this.isMac = this.platform === Platforms.Mac;
    this.registerAppEventListeners();
    this.registerSingleInstanceHandler();
    this.registerIpcEventListeners();
  }

  registerSingleInstanceHandler() {
    const hasRequestSingleInstanceLock = app.requestSingleInstanceLock
      ? true // eslint-disable-line no-unneeded-ternary
      : false;

    /* Someone tried to run a second instance, we should focus our window. */
    const handleSecondInstance = () => {
      if (this.window) {
        if (!this.window.isVisible()) {
          this.window.show();
        }
        if (this.window.isMinimized()) {
          this.window.restore();
        }
        this.window.focus();
      }
    };

    if (hasRequestSingleInstanceLock) {
      this.isSecondInstance = !app.requestSingleInstanceLock();
      app.on('second-instance', () => {
        handleSecondInstance();
      });
    } else {
      this.isSecondInstance = app.makeSingleInstance(() => {
        handleSecondInstance();
      });
    }
  }

  registerIpcEventListeners() {
    ipcMain.on(IpcMessages.DisplayAppMenu, (_event, position) => {
      this.menuManager.popupMenu(position);
    });

    ipcMain.on(IpcMessages.InitialDataLoaded, () => {
      this.archiveManager.beginBackups();
    });

    ipcMain.on(IpcMessages.MajorDataChange, () => {
      this.archiveManager.performBackup();
    });
  }

  registerAppEventListeners() {
    app.on('window-all-closed', () => {
      if (!this.isMac) {
        app.quit();
      }
    });

    app.on('before-quit', () => {
      this.willQuitApp = true;
    });

    app.on('activate', () => {
      this.window.focus();
      this.updateManager.checkForUpdate();
    });

    app.on('ready', () => {
      if (this.isSecondInstance) {
        console.warn('Quiting app and focusing existing instance.');
        app.quit();
      } else {
        this.createExtensionsServer();
        this.createWindow();

        this.menuManager.loadMenu();
        this.updateManager.onNeedMenuReload = () => {
          this.menuManager.reload();
        };

        const isWindowsOrLinux =
          this.platform === Platforms.Windows ||
          this.platform === Platforms.Linux;
        if (isWindowsOrLinux && this.trayManager.shouldMinimizeToTray()) {
          this.trayManager.createTrayIcon();
        }
      }
    });
  }

  createExtensionsServer() {
    const host = createExtensionsServer();
    Store.set(StoreKeys.ExtServerHost, host);
  }

  createWindow() {
    const winState = windowStateKeeper({
      defaultWidth: WINDOW_DEFAULT_WIDTH,
      defaultHeight: WINDOW_DEFAULT_HEIGHT
    });
    const iconLocation = path.join(__dirname, '/icon/Icon-512x512.png');
    const useSystemMenuBar = Store.get(StoreKeys.UseSystemMenuBar);
    const titleBarStyle = this.isMac || useSystemMenuBar ? 'hiddenInset' : null;
    this.window = new BrowserWindow({
      x: winState.x,
      y: winState.y,
      width: winState.width,
      height: winState.height,
      minWidth: WINDOW_MIN_WIDTH,
      minHeight: WINDOW_MIN_HEIGHT,
      show: false,
      icon: iconLocation,
      titleBarStyle: titleBarStyle,
      frame: this.isMac ? false : useSystemMenuBar,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'javascripts/renderer/preload.js')
      }
    });

    winState.manage(this.window);

    this.createWindowDependentServices(this.window);

    this.window.on('closed', () => {
      this.window = null;
    });

    this.window.on('blur', () => {
      this.window.webContents.send(IpcMessages.WindowBlurred, null);
      this.archiveManager.applicationDidBlur();
    });

    this.window.on('focus', () => {
      this.window.webContents.send(IpcMessages.WindowFocused, null);
    });

    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    this.window.on('close', event => {
      if (this.willQuitApp) {
        /* The user tried to quit the app */
        this.window = null;
      } else if (this.isMac || this.trayManager.shouldMinimizeToTray()) {
        /* The user only tried to close the window */
        event.preventDefault();
        /* Handles Mac full screen issue where pressing close results in a black screen. */
        if (this.window.isFullScreen()) {
          this.window.setFullScreen(false);
        }
        this.window.hide();
      }
    });

    let windowUrl;
    if ('APP_RELATIVE_PATH' in process.env) {
      windowUrl = path.join(
        'file://',
        __dirname,
        process.env.APP_RELATIVE_PATH,
        index
      );
    } else {
      windowUrl = path.join('file://', __dirname, index);
    }
    this.window.loadURL(windowUrl);

    const shouldOpenUrl = url => {
      return url.startsWith('http') || url.startsWith('https');
    };
    /**
     * Check file urls for equality by decoding components
     * In packaged app, spaces in navigation events urls can contain %20 but
     * not in windowUrl.
     */
    const safeFileUrlCompare = (a, b) => {
      /** Catch exceptions in case of malformed urls. */
      try {
        /**
         * Craft URL objects to eliminate production URL values that can
         * contain "#!/" suffixes (on Windows)
         */
        const aPath = new URL(decodeURIComponent(a)).pathname;
        const bPath = new URL(decodeURIComponent(b)).pathname;
        return aPath === bPath;
      } catch (error) {
        return false;
      }
    };

    /** handle link clicks */
    this.window.webContents.on('new-window', (event, url) => {
      if (shouldOpenUrl(url)) {
        shell.openExternal(url);
      }
      event.preventDefault();
    });

    /**
     * handle link clicks (this event is fired instead of 'new-window' when
     * target is not set to _blank)
     */
    this.window.webContents.on('will-navigate', (event, url) => {
      /** Check for windowUrl equality in the case of window.reload() calls. */
      if (safeFileUrlCompare(url, windowUrl) === true) {
        return;
      }
      if (shouldOpenUrl(url)) {
        shell.openExternal(url);
      }
      event.preventDefault();
    });
  }

  createWindowDependentServices(window) {
    initializePackageManager(window.webContents);
    this.archiveManager = new ArchiveManager(window);
    this.searchManager = new SearchManager(window);
    this.trayManager = createTrayManager(window, Store, this.platform);
    this.updateManager = new UpdateManager(window);
    this.zoomManager = new ZoomManager(window);
    this.menuManager = new MenuManager(
      window,
      this.archiveManager,
      this.updateManager,
      this.trayManager
    );
  }

  openDevTools() {
    this.window.webContents.openDevTools();
  }
}

export function createDesktopApplication() {
  // eslint-disable-next-line no-new
  new DesktopApplication();
}
