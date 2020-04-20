import { App, IpcMain, Shell } from 'electron';
import path from 'path';
import index from './index.html';
import { ArchiveManager } from './javascripts/main/archiveManager';
import { createExtensionsServer } from './javascripts/main/extServer';
import { MenuManager } from './javascripts/main/menus';
import { isLinux, isMac, isWindows } from './javascripts/main/platforms';
import { Store, StoreKeys } from './javascripts/main/store';
import { AppName, initializeStrings } from './javascripts/main/strings';
import { createWindowState, WindowState } from './javascripts/main/window';
import { IpcMessages } from './javascripts/shared/ipcMessages';
import { isDev } from './javascripts/main/utils';

export interface AppState {
  readonly store: Store;
  readonly startUrl: string;
  isPrimaryInstance: boolean;
  willQuitApp: boolean;

  windowState?: WindowState;
}

export function initializeApplication(args: {
  app: Electron.App;
  ipcMain: Electron.IpcMain;
  shell: Shell;
}) {
  const { app } = args;

  app.name = AppName;
  app.allowRendererProcessReuse = true;

  const isPrimaryInstance = app.requestSingleInstanceLock();

  const state: AppState = {
    store: new Store(app.getPath('userData')),
    startUrl: determineStartUrl(),
    isPrimaryInstance,
    willQuitApp: false
  };
  registerSingleInstanceHandler(app, state);
  registerAppEventListeners({
    ...args,
    state
  });

  if (isDev()) {
    /** Expose the app's state as a global variable. Useful for debugging */
    (global as any).appState = state;
  }
}

function determineStartUrl(): string {
  if ('APP_RELATIVE_PATH' in process.env) {
    return path.join(
      'file://',
      __dirname,
      process.env.APP_RELATIVE_PATH as string,
      index
    );
  }
  return path.join('file://', __dirname, index);
}

function registerSingleInstanceHandler(
  app: Electron.App,
  appState: Pick<AppState, 'windowState'>
) {
  app.on('second-instance', () => {
    /* Someone tried to run a second instance, we should focus our window. */
    const window = appState.windowState?.window;
    if (window) {
      if (!window.isVisible()) {
        window.show();
      }
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });
}

function registerAppEventListeners(args: {
  app: Electron.App;
  ipcMain: Electron.IpcMain;
  shell: Shell;
  state: AppState;
}) {
  const { app, state } = args;

  app.on('window-all-closed', () => {
    if (!isMac()) {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    state.willQuitApp = true;
  });

  app.on('activate', () => {
    const windowState = state.windowState;
    if (!windowState) return;
    windowState.window.show();
    windowState.updateManager.checkForUpdate();
  });

  app.on('ready', () => {
    if (!state.isPrimaryInstance) {
      console.warn('Quiting app and focusing existing instance.');
      app.quit();
      return;
    }

    finishApplicationInitialization(args);
  });
}

function finishApplicationInitialization({
  app,
  ipcMain,
  shell,
  state
}: {
  app: App;
  ipcMain: IpcMain;
  shell: Shell;
  state: AppState;
}) {
  initializeStrings(app.getLocale());
  initializeExtensionsServer(state.store);
  const windowState = createWindowState({
    shell,
    appState: state,
    appLocale: app.getLocale(),
    teardown() {
      state.windowState = undefined;
    }
  });
  state.windowState = windowState;
  registerIpcEventListeners(
    ipcMain,
    windowState.menuManager,
    windowState.archiveManager
  );

  if (
    (isWindows() || isLinux()) &&
    state.windowState.trayManager.shouldMinimizeToTray()
  ) {
    state.windowState.trayManager.createTrayIcon();
  }

  windowState.window.loadURL(state.startUrl);
}

function initializeExtensionsServer(store: Store) {
  const host = createExtensionsServer();
  store.set(StoreKeys.ExtServerHost, host);
}

function registerIpcEventListeners(
  ipcMain: Electron.IpcMain,
  menuManager: MenuManager,
  archiveManager: ArchiveManager
) {
  ipcMain.on(IpcMessages.DisplayAppMenu, () => {
    menuManager.popupMenu();
  });

  ipcMain.on(IpcMessages.InitialDataLoaded, () => {
    archiveManager.beginBackups();
  });

  ipcMain.on(IpcMessages.MajorDataChange, () => {
    archiveManager.performBackup();
  });
}
