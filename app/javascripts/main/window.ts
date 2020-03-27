import { BrowserWindow, Shell } from 'electron';
import windowStateKeeper from 'electron-window-state';
import path from 'path';
import { AppState } from '../../application';
import { CommandLineArgs } from '../shared/CommandLineArgs';
import { IpcMessages } from '../shared/ipcMessages';
import { ArchiveManager } from './archiveManager';
import { createMenuManager, MenuManager } from './menuManager';
import { initializePackageManager } from './packageManager';
import { isMac } from './platforms';
import { initializeSearchManager } from './searchManager';
import { createSpellcheckerManager } from './spellcheckerManager';
import { Store, StoreKeys } from './store';
import { createTrayManager, TrayManager } from './trayManager';
import { createUpdateManager, UpdateManager } from './updateManager';
import { initializeZoomManager } from './zoomManager';

const WINDOW_DEFAULT_WIDTH = 1100;
const WINDOW_DEFAULT_HEIGHT = 800;
const WINDOW_MIN_WIDTH = 300;
const WINDOW_MIN_HEIGHT = 400;

export interface WindowState {
  window: Electron.BrowserWindow;
  menuManager: MenuManager;
  archiveManager: ArchiveManager;
  updateManager: UpdateManager;
  trayManager: TrayManager;
}

export function createWindowState({
  shell,
  appState,
  appLocale,
  teardown
}: {
  shell: Shell;
  appLocale: string;
  appState: Pick<AppState, 'willQuitApp' | 'startUrl' | 'store'>;
  teardown: () => void;
}): WindowState {
  const window = createWindow();
  const services = createWindowServices(window, appState.store, appLocale);
  registerWindowEventListeners({
    shell,
    appState,
    window,
    archiveManager: services.archiveManager,
    trayManager: services.trayManager,
    onClosed: teardown
  });

  return {
    window,
    ...services
  };
}

function createWindow(): Electron.BrowserWindow {
  const winState = windowStateKeeper({
    defaultWidth: WINDOW_DEFAULT_WIDTH,
    defaultHeight: WINDOW_DEFAULT_HEIGHT
  });
  const useSystemMenuBar = Store.get(StoreKeys.UseSystemMenuBar);

  const isTesting = process.argv.includes(CommandLineArgs.Testing);
  const window = new BrowserWindow({
    x: winState.x,
    y: winState.y,
    width: winState.width,
    height: winState.height,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    show: false,
    icon: path.join(__dirname, '/icon/Icon-512x512.png'),
    titleBarStyle: isMac || useSystemMenuBar ? 'hiddenInset' : undefined,
    frame: isMac ? false : useSystemMenuBar,
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

  winState.manage(window);
  return window;
}

function createWindowServices(
  window: Electron.BrowserWindow,
  store: Store,
  appLocale: string
) {
  initializePackageManager(window.webContents);
  initializeSearchManager(window.webContents);
  initializeZoomManager(window.webContents, store);
  const archiveManager = new ArchiveManager(window);
  const updateManager = createUpdateManager(window);
  const trayManager = createTrayManager(window, store);
  const spellcheckerManager = createSpellcheckerManager(
    store,
    window.webContents,
    appLocale
  );
  const menuManager = createMenuManager({
    window,
    archiveManager,
    updateManager,
    trayManager,
    store,
    spellcheckerManager
  });
  return {
    archiveManager,
    updateManager,
    trayManager,
    spellcheckerManager,
    menuManager
  };
}

function registerWindowEventListeners({
  shell,
  appState,
  window,
  archiveManager,
  trayManager,
  onClosed
}: {
  shell: Shell;
  appState: Pick<AppState, 'willQuitApp' | 'startUrl'>;
  window: Electron.BrowserWindow;
  archiveManager: ArchiveManager;
  trayManager: TrayManager;
  onClosed: () => void;
}) {
  const shouldOpenUrl = (url: string) =>
    url.startsWith('http') || url.startsWith('mailto');

  /**
   * Check file urls for equality by decoding components
   * In packaged app, spaces in navigation events urls can contain %20
   * but not in windowUrl.
   */
  const safeFileUrlCompare = (a: string, b: string) => {
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

  window.on('closed', onClosed);

  window.on('focus', () => {
    window.webContents.send(IpcMessages.WindowFocused, null);
  });

  window.on('blur', () => {
    window.webContents.send(IpcMessages.WindowBlurred, null);
    archiveManager.applicationDidBlur();
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('close', event => {
    if (
      !appState.willQuitApp &&
      (isMac || trayManager.shouldMinimizeToTray())
    ) {
      /**
       * On MacOS, closing a window does not quit the app. On Window and Linux,
       * it only does if you haven't enabled minimize to tray.
       */
      event.preventDefault();
      /**
       * Handles Mac full screen issue where pressing close results
       * in a black screen.
       */
      if (window.isFullScreen()) {
        window.setFullScreen(false);
      }
      window.hide();
    }
  });

  /** handle link clicks */
  window.webContents.on('new-window', (event, url) => {
    if (shouldOpenUrl(url)) {
      shell.openExternal(url);
    }
    event.preventDefault();
  });

  /**
   * handle link clicks (this event is fired instead of 'new-window' when
   * target is not set to _blank)
   */
  window.webContents.on('will-navigate', (event, url) => {
    /** Check for windowUrl equality in the case of window.reload() calls. */
    if (safeFileUrlCompare(url, appState.startUrl) === true) {
      return;
    }
    if (shouldOpenUrl(url)) {
      shell.openExternal(url);
    }
    event.preventDefault();
  });
}
