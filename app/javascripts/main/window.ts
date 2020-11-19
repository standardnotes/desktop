import {
  app,
  BrowserWindow,
  ipcMain,
  Rectangle,
  screen,
  Shell,
} from 'electron';
import fs from 'fs';
import { debounce } from 'lodash';
import path from 'path';
import { AppMessageType, MessageType } from '../../../test/TestIpcMessage';
import { AppState } from '../../application';
import { IpcMessages } from '../shared/ipcMessages';
import { BackupsManager, createBackupsManager } from './backupsManager';
import { buildContextMenu, createMenuManager, MenuManager } from './menus';
import { initializePackageManager } from './packageManager';
import { isMac, isWindows } from './platforms';
import { initializeSearchManager } from './searchManager';
import { createSpellcheckerManager } from './spellcheckerManager';
import { Store, StoreKeys } from './store';
import { handle, send } from './testing';
import { createTrayManager, TrayManager } from './trayManager';
import { createUpdateManager, UpdateManager } from './updateManager';
import { isTesting, lowercaseDriveLetter } from './utils';
import { initializeZoomManager } from './zoomManager';
import { preloadJsPath } from './paths';

const WINDOW_DEFAULT_WIDTH = 1100;
const WINDOW_DEFAULT_HEIGHT = 800;
const WINDOW_MIN_WIDTH = 300;
const WINDOW_MIN_HEIGHT = 400;

export interface WindowState {
  window: Electron.BrowserWindow;
  menuManager: MenuManager;
  backupsManager: BackupsManager;
  updateManager: UpdateManager;
  trayManager: TrayManager;
}

export async function createWindowState({
  shell,
  appState,
  appLocale,
  teardown,
}: {
  shell: Shell;
  appLocale: string;
  appState: AppState;
  teardown: () => void;
}): Promise<WindowState> {
  const window = await createWindow(appState.store);
  const services = createWindowServices(window, appState, appLocale);
  registerWindowEventListeners({
    shell,
    appState,
    window,
    backupsManager: services.backupsManager,
    trayManager: services.trayManager,
    updateManager: services.updateManager,
    onClosed: teardown,
  });

  return {
    window,
    ...services,
  };
}

async function createWindow(store: Store): Promise<Electron.BrowserWindow> {
  const useSystemMenuBar = store.get(StoreKeys.UseSystemMenuBar);
  const position = await getPreviousWindowPosition();
  const window = new BrowserWindow({
    ...position.bounds,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    show: false,
    icon: path.join(__dirname, '/icon/Icon-512x512.png'),
    titleBarStyle: isMac() || useSystemMenuBar ? 'hiddenInset' : undefined,
    frame: isMac() ? false : useSystemMenuBar,
    webPreferences: {
      enableRemoteModule: true,
      spellcheck: true,
      nodeIntegration: isTesting(),
      contextIsolation: !isTesting(),
      preload: preloadJsPath,
    },
  });
  if (position.isFullScreen) {
    window.setFullScreen(true);
  }

  if (position.isMaximized) {
    window.maximize();
  }
  persistWindowPosition(window);

  if (isTesting()) {
    handle(MessageType.SpellCheckerLanguages, () =>
      window.webContents.session.getSpellCheckerLanguages()
    );
    window.webContents.once('did-finish-load', () => {
      send(AppMessageType.WindowLoaded);
    });
  }

  return window;
}

function createWindowServices(
  window: Electron.BrowserWindow,
  appState: AppState,
  appLocale: string
) {
  initializePackageManager(ipcMain, window.webContents);
  initializeSearchManager(window.webContents);
  initializeZoomManager(window, appState.store);
  const backupsManager = createBackupsManager(
    window.webContents,
    appState,
    ipcMain
  );
  const updateManager = createUpdateManager(window, appState);
  const trayManager = createTrayManager(window, appState.store);
  const spellcheckerManager = createSpellcheckerManager(
    appState.store,
    window.webContents,
    appLocale
  );
  if (isTesting()) {
    handle(MessageType.SpellCheckerManager, () => spellcheckerManager);
  }
  const menuManager = createMenuManager({
    window,
    backupsManager,
    updateManager,
    trayManager,
    store: appState.store,
    spellcheckerManager,
  });
  return {
    backupsManager,
    updateManager,
    trayManager,
    spellcheckerManager,
    menuManager,
  };
}

/**
 * Check file urls for equality by decoding components
 * In packaged app, spaces in navigation events urls can contain %20
 * but not in windowUrl.
 */
function fileUrlsAreEqual(a: string, b: string): boolean {
  /** Catch exceptions in case of malformed urls. */
  try {
    /**
     * Craft URL objects to eliminate production URL values that can
     * contain "#!/" suffixes (on Windows)
     */
    let aPath = new URL(decodeURIComponent(a)).pathname;
    let bPath = new URL(decodeURIComponent(b)).pathname;
    if (isWindows()) {
      /** On Windows, drive letter casing is inconsistent */
      aPath = lowercaseDriveLetter(aPath);
      bPath = lowercaseDriveLetter(bPath);
    }
    return aPath === bPath;
  } catch (error) {
    return false;
  }
}

function registerWindowEventListeners({
  shell,
  appState,
  window,
  backupsManager,
  trayManager,
  updateManager,
  onClosed,
}: {
  shell: Shell;
  appState: Pick<AppState, 'willQuitApp' | 'startUrl'>;
  window: Electron.BrowserWindow;
  backupsManager: BackupsManager;
  trayManager: TrayManager;
  updateManager: UpdateManager;
  onClosed: () => void;
}) {
  const shouldOpenUrl = (url: string) =>
    url.startsWith('http') || url.startsWith('mailto');

  window.on('closed', onClosed);

  window.on('show', () => {
    updateManager.checkForUpdate(false);
  });

  window.on('focus', () => {
    window.webContents.send(IpcMessages.WindowFocused, null);
  });

  window.on('blur', () => {
    window.webContents.send(IpcMessages.WindowBlurred, null);
    backupsManager.applicationDidBlur();
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('close', (event) => {
    if (
      !appState.willQuitApp &&
      (isMac() || trayManager.shouldMinimizeToTray())
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
    if (fileUrlsAreEqual(url, appState.startUrl)) {
      return;
    }
    if (shouldOpenUrl(url)) {
      shell.openExternal(url);
    }
    event.preventDefault();
  });

  window.webContents.on('context-menu', (_event, params) => {
    buildContextMenu(window.webContents, params).popup();
  });
}

interface WindowPosition {
  bounds: Rectangle;
  isMaximized: boolean;
  isFullScreen: boolean;
}

async function getPreviousWindowPosition() {
  let position: WindowPosition;
  try {
    position = JSON.parse(
      await fs.promises.readFile(
        path.join(app.getPath('userData'), 'window-position.json'),
        'utf8'
      )
    );
  } catch (e) {
    return {
      bounds: {
        width: WINDOW_DEFAULT_WIDTH,
        height: WINDOW_DEFAULT_HEIGHT,
      },
    };
  }

  const options: Partial<Rectangle> = {};
  const bounds = position.bounds;
  if (bounds) {
    /** Validate coordinates. Keep them if the window can fit on a screen */
    const area = screen.getDisplayMatching(bounds).workArea;
    if (
      bounds.x >= area.x &&
      bounds.y >= area.y &&
      bounds.x + bounds.width <= area.x + area.width &&
      bounds.y + bounds.height <= area.y + area.height
    ) {
      options.x = bounds.x;
      options.y = bounds.y;
    }
    if (bounds.width <= area.width || bounds.height <= area.height) {
      options.width = bounds.width;
      options.height = bounds.height;
    }
  }

  return {
    isMaximized: position.isMaximized,
    isFullScreen: position.isFullScreen,
    bounds: {
      width: WINDOW_DEFAULT_WIDTH,
      height: WINDOW_DEFAULT_HEIGHT,
      ...options,
    },
  };
}

function persistWindowPosition(window: BrowserWindow) {
  const savePath = path.join(app.getPath('userData'), 'window-position.json');
  let writingToDisk = false;

  const saveWindowBounds = debounce(async () => {
    const position: WindowPosition = {
      bounds: window.getNormalBounds(),
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
    };
    if (writingToDisk) return;
    writingToDisk = true;
    try {
      await fs.promises.writeFile(savePath, JSON.stringify(position), 'utf-8');
    } catch (error) {
      console.error('Could not write to window-position.json', error);
    } finally {
      writingToDisk = false;
    }
  }, 500);

  window.on('resize', saveWindowBounds);
  window.on('move', saveWindowBounds);
}
