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
import {
  Store,
  StoreKeys
} from './javascripts/main/store';
import { AppName } from './javascripts/main/strings';
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
    case "darwin":
      return Platforms.Mac;
    case "win32":
      return Platforms.Windows;
    case "linux":
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
    Store.set(StoreKeys.ExtServerHost, createExtensionsServer());
    this.registerAppEventListeners();
    this.registerSingleInstanceHandler();
    this.registerIpcEventListeners();
  }

  registerSingleInstanceHandler() {
    // eslint-disable-next-line no-unneeded-ternary
    const hasRequestSingleInstanceLock = app.requestSingleInstanceLock ? true : false;
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
      app.on('second-instance', (event, argv, cwd) => {
        handleSecondInstance();
      });
    } else {
      this.isSecondInstance = app.makeSingleInstance((argv, cwd) => {
        handleSecondInstance();
      });
    }
  }

  registerIpcEventListeners() {
    ipcMain.on("display-app-menu", (event, position) => {
      this.menuManager.popupMenu(position);
    });

    ipcMain.on('initial-data-loaded', () => {
      this.archiveManager.beginBackups();
    });

    ipcMain.on('major-data-change', () => {
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
      this.createOrFocusWindow();
      this.updateManager.checkForUpdate();
    });

    app.on('ready', () => {
      if (this.isSecondInstance) {
        console.warn("Quiting app and focusing existing instance.");
        app.quit();
      } else {
        this.createOrFocusWindow();

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

  createOrFocusWindow() {
    if (this.window) {
      this.window.focus();
    } else {
      this.createWindow();
    }
  }

  createWindow() {
    const winState = windowStateKeeper({
      defaultWidth: WINDOW_DEFAULT_WIDTH,
      defaultHeight: WINDOW_DEFAULT_HEIGHT
    });
    const iconLocation = path.join(__dirname, '/icon/Icon-512x512.png');
    const useSystemMenuBar = Store.get(StoreKeys.UseSystemMenuBar);
    const titleBarStyle = (this.isMac || useSystemMenuBar)
      ? 'hiddenInset'
      : null;
    this.window = new BrowserWindow({
      'x': winState.x,
      'y': winState.y,
      'width': winState.width,
      'height': winState.height,
      'minWidth': WINDOW_MIN_WIDTH,
      'minHeight': WINDOW_MIN_HEIGHT,
      show: false,
      icon: iconLocation,
      titleBarStyle: titleBarStyle,
      frame: this.isMac ? false : useSystemMenuBar,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "javascripts/renderer/preload.js")
      }
    });

    winState.manage(this.window);

    initializePackageManager(this.window.webContents);
    this.archiveManager = new ArchiveManager(this.window);
    this.searchManager = new SearchManager(this.window);
    this.trayManager = createTrayManager(this.window, Store, this.platform);
    this.updateManager = new UpdateManager(this.window);
    this.zoomManager = new ZoomManager(this.window);
    this.menuManager = new MenuManager(
      this.window,
      this.archiveManager,
      this.updateManager,
      this.trayManager
    );

    this.window.on('closed', (event) => {
      this.window = null;
    });

    this.window.on('blur', (event) => {
      this.window.webContents.send("window-blurred", null);
      this.archiveManager.applicationDidBlur();
    });

    this.window.on('focus', (event) => {
      this.window.webContents.send("window-focused", null);
    });

    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    this.window.on('close', (event) => {
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
      windowUrl = path.join('file://', __dirname, process.env.APP_RELATIVE_PATH, index);
    } else {
      windowUrl = path.join('file://', __dirname, index);
    }
    this.window.loadURL(windowUrl);

    const shouldOpenUrl = (url) => {
      return url.startsWith("http") || url.startsWith("https");
    };
    // Check file urls for equality by decoding components
    // In packaged app, spaces in navigation events urls can contain %20 but not in windowUrl.
    const safeFileUrlCompare = (a, b) => {
      // Catch exceptions in case of malformed urls.
      try {
        // Craft URL objects to eliminate production URL values that can contain "#!/" suffixes (on Windows)
        const aPath = new URL(decodeURIComponent(a)).pathname;
        const bPath = new URL(decodeURIComponent(b)).pathname;
        return aPath === bPath;
      } catch (error) {
        return false;
      }
    };

    // handle link clicks
    this.window.webContents.on('new-window', (event, url) => {
      if (shouldOpenUrl(url)) {
        shell.openExternal(url);
      }
      event.preventDefault();
    });

    // handle link clicks (this event is fired instead of
    // 'new-window' when target is not set to _blank)
    this.window.webContents.on('will-navigate', (event, url) => {
      // Check for windowUrl equality in the case of window.reload() calls.
      if (safeFileUrlCompare(url, windowUrl) === true) {
        return;
      }
      if (shouldOpenUrl(url)) {
        shell.openExternal(url);
      }
      event.preventDefault();
    });
  }
}

export function createDesktopApplication() {
  // eslint-disable-next-line no-new
  new DesktopApplication();
}
