import {
  ArchiveManager,
  createExtensionsServer,
  createMenuManager,
  PackageManager,
  SearchManager,
  createTrayManager,
  UpdateManager,
  ZoomManager,
  createSpellcheckerManager
} from './javascripts/main';
import {
  Store,
  StoreKeys
} from './javascripts/main/store';
import { AppName } from './javascripts/main/strings';
import index from './index.html';
import { CommandLineArgs } from './javascripts/shared/CommandLineArgs';

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
  Linux: 3,
  isMac: (platform) => {
    return platform === Platforms.Mac;
  },
};

export class DesktopApplication {

  static instance = null;

  static createSharedApplication() {
    const getPlatform = () => {
      const processPlatform = process.platform;
      if (processPlatform === 'darwin') {
        return Platforms.Mac;
      } else if (processPlatform === 'win32') {
        return Platforms.Windows;
      } else if (processPlatform === 'linux') {
        return Platforms.Linux;
      }
    };
    this.instance = new DesktopApplication({
      platform: getPlatform()
    });
  }

  static sharedApplication() {
    if (!this.instance) {
      throw 'Attempting to access application before creation';
    }
    return this.instance;
  }

  constructor({
    platform
  }) {
    this.platform = platform;
    this.isMac = Platforms.isMac(this.platform);
    app.name = AppName;
    app.allowRendererProcessReuse = false;
    this.registerAppEventListeners();
    this.registerSingleInstanceHandler();
    this.registerIpcEventListeners();
  }

  createExtensionsServer() {
    const host = createExtensionsServer();
    Store.set(StoreKeys.ExtServerHost, host);
  }

  onWindowCreate() {
    this.createServices();
    this.createExtensionsServer();
  }

  createServices() {
    this.archiveManager = new ArchiveManager(this.window);
    this.packageManager = new PackageManager(this.window);
    this.searchManager = new SearchManager(this.window);
    this.trayManager = createTrayManager(this.window, Store, this.platform);
    this.updateManager = new UpdateManager(this.window);
    this.zoomManager = new ZoomManager(this.window);
    const spellcheckerManager = createSpellcheckerManager(
      Store.getInstance(),
      this.window.webContents,
      app.getLocale()
    );
    this.menuManager = createMenuManager({
      window: this.window,
      archiveManager: this.archiveManager,
      updateManager: this.updateManager,
      trayManager: this.trayManager,
      store: Store.getInstance(),
      spellcheckerManager
    });
  }

  registerSingleInstanceHandler() {
    // eslint-disable-next-line no-unneeded-ternary
    const hasRequestSingleInstanceLock = app.requestSingleInstanceLock ? true : false;
    /* Someone tried to run a second instance, we should focus our window. */
    const handleSecondInstance = (argv, cwd) => {
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
        handleSecondInstance(argv, cwd);
      });
    } else {
      this.isSecondInstance = app.makeSingleInstance((argv, cwd) => {
        handleSecondInstance(argv, cwd);
      });
    }
  }

  registerIpcEventListeners() {
    ipcMain.on('display-app-menu', (event, position) => {
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
      if (!this.window) {
        this.createWindow();
      } else {
        this.window.show();
      }
      this.updateManager.checkForUpdate();
    });

    app.on('ready', () => {
      if (this.isSecondInstance) {
        console.warn('Quiting app and focusing existing instance.');
        app.quit();
      } else {
        if (!this.window) {
          this.createWindow();
        } else {
          this.window.focus();
        }

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

    const isTesting = process.argv.includes(CommandLineArgs.Testing);
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
        spellcheck: true,
        /**
         * During testing, we expose unsafe node apis to the browser window as
         * required by spectron (^10.0.0)
         */
        nodeIntegration: isTesting,
        contextIsolation: !isTesting,
        preload: path.join(__dirname, 'javascripts/renderer/preload.js')
      }
    });

    winState.manage(this.window);
    this.onWindowCreate();

    this.window.on('closed', (event) => {
      this.window = null;
    });

    this.window.on('blur', (event) => {
      this.window.webContents.send('window-blurred', null);
      this.archiveManager.applicationDidBlur();
    });

    this.window.on('focus', (event) => {
      this.window.webContents.send('window-focused', null);
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

    const shouldOpenUrl = url =>
      url.startsWith('http') || url.startsWith('mailto');

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

  openDevTools() {
    this.window.webContents.openDevTools();
  }
}
