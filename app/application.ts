import { App, IpcMain, Shell } from 'electron';
import { BackupsManager } from './javascripts/main/backupsManager';
import { createExtensionsServer } from './javascripts/main/extServer';
import { MenuManager } from './javascripts/main/menus';
import { isLinux, isMac, isWindows } from './javascripts/main/platforms';
import { Store, StoreKeys } from './javascripts/main/store';
import { AppName, initializeStrings } from './javascripts/main/strings';
import { createWindowState, WindowState } from './javascripts/main/window';
import {
  getKeychainValue,
  setKeychainValue,
  clearKeychainValue,
  ensureKeychainAccess,
} from './javascripts/main/keychain';
import { IpcMessages } from './javascripts/shared/ipcMessages';
import { isDev } from './javascripts/main/utils';
import { indexUrl } from './javascripts/main/paths';
import { action, makeObservable, observable } from 'mobx';

export class AppState {
  readonly store: Store;
  readonly startUrl = indexUrl;
  readonly isPrimaryInstance: boolean;
  public willQuitApp = false;
  public lastBackupDate: number | null = null;
  public windowState?: WindowState;

  constructor(app: Electron.App) {
    this.store = new Store(app.getPath('userData'));
    this.isPrimaryInstance = app.requestSingleInstanceLock();
    makeObservable(this, {
      lastBackupDate: observable,
      setBackupCreationDate: action,
    });
  }

  setBackupCreationDate(date: number | null): void {
    this.lastBackupDate = date;
  }
}

export function initializeApplication(args: {
  app: Electron.App;
  ipcMain: Electron.IpcMain;
  shell: Shell;
}): void {
  const { app } = args;

  app.name = AppName;
  app.allowRendererProcessReuse = true;

  const state = new AppState(app);
  registerSingleInstanceHandler(app, state);
  registerAppEventListeners({
    ...args,
    state,
  });

  if (isDev()) {
    /** Expose the app's state as a global variable. Useful for debugging */
    (global as any).appState = state;
  }
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

async function finishApplicationInitialization({
  app,
  ipcMain,
  shell,
  state,
}: {
  app: App;
  ipcMain: IpcMain;
  shell: Shell;
  state: AppState;
}) {
  const keychainWindow = await ensureKeychainAccess(state.store);

  initializeStrings(app.getLocale());
  initializeExtensionsServer(state.store);
  const windowState = await createWindowState({
    shell,
    appState: state,
    appLocale: app.getLocale(),
    teardown() {
      state.windowState = undefined;
    },
  });

  /**
   * Close the keychain window after the main window is created, otherwise the
   * app will quit automatically
   */
  keychainWindow?.close();

  state.windowState = windowState;
  registerIpcEventListeners(
    ipcMain,
    windowState.menuManager,
    windowState.backupsManager
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
  archiveManager: BackupsManager
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

  ipcMain.handle(IpcMessages.GetKeychainValue, getKeychainValue);
  ipcMain.handle(IpcMessages.SetKeychainValue, (_event, value) =>
    setKeychainValue(value)
  );
  ipcMain.handle(IpcMessages.ClearKeychainValue, clearKeychainValue);
}
