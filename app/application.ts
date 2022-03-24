import { App, IpcMain, shell, Shell } from 'electron';
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
import { isDev, isTesting } from './javascripts/main/utils';
import { Urls, Paths } from './javascripts/main/paths';
import { action, makeObservable, observable } from 'mobx';
import { UpdateState } from './javascripts/main/updateManager';
import { handleTestMessage } from './javascripts/main/testing';
import { MessageType } from '../test/TestIpcMessage';
import SecureSpellChecker from '@standardnotes/electron-secure-spellchecker';

try {
  SecureSpellChecker.setup();
} catch (error) {
  console.error('Error setting up SecureSpellChecker', error);
}

const deepLinkScheme = 'standardnotes';

export class AppState {
  readonly version: string;
  readonly store: Store;
  readonly startUrl = Urls.indexHtml;
  readonly isPrimaryInstance: boolean;
  public willQuitApp = false;
  public lastBackupDate: number | null = null;
  public windowState?: WindowState;
  public deepLinkUrl?: string;
  public readonly updates: UpdateState;

  constructor(app: Electron.App) {
    this.version = app.getVersion();
    this.store = new Store(Paths.userDataDir);
    this.isPrimaryInstance = app.requestSingleInstanceLock();
    makeObservable(this, {
      lastBackupDate: observable,
      setBackupCreationDate: action,
    });
    this.updates = new UpdateState(this);

    if (isTesting()) {
      handleTestMessage(MessageType.AppStateCall, (method, ...args) => {
        (this as any)[method](...args);
      });
    }
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

  const state = new AppState(app);
  setupDeepLinking(app);
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

function focusWindow(appState: AppState) {
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
}

function registerSingleInstanceHandler(app: Electron.App, appState: AppState) {
  app.on('second-instance', (_event: Event, argv: string[]) => {
    if (isWindows()) {
      appState.deepLinkUrl = argv.find((arg) => arg.startsWith(deepLinkScheme));
    }

    /* Someone tried to run a second instance, we should focus our window. */
    focusWindow(appState);
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

  app.on('open-url', (_event, url) => {
    state.deepLinkUrl = url;
    focusWindow(state);
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

async function setupDeepLinking(app: Electron.App) {
  if (!app.isDefaultProtocolClient(deepLinkScheme)) {
    app.setAsDefaultProtocolClient(deepLinkScheme);
  }
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
  registerIpcEventListeners(ipcMain, windowState.menuManager, windowState.backupsManager);

  if ((isWindows() || isLinux()) && state.windowState.trayManager.shouldMinimizeToTray()) {
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
  backupsManager: BackupsManager
) {
  ipcMain.on(IpcMessages.DisplayAppMenu, () => {
    menuManager.popupMenu();
  });

  ipcMain.on(IpcMessages.InitialDataLoaded, () => {
    backupsManager.beginBackups();
  });

  ipcMain.on(IpcMessages.MajorDataChange, () => {
    backupsManager.performBackup();
  });

  ipcMain.handle(IpcMessages.GetKeychainValue, getKeychainValue);
  ipcMain.handle(IpcMessages.SetKeychainValue, (_event, value) => setKeychainValue(value));
  ipcMain.handle(IpcMessages.ClearKeychainValue, clearKeychainValue);
  ipcMain.handle(IpcMessages.LocalBackupsCount, () => backupsManager.backupsCount());
  ipcMain.on(IpcMessages.ViewLocalBackups, () => {
    shell.openPath(backupsManager.backupsLocation);
  });
  ipcMain.handle(IpcMessages.DeleteLocalBackups, () => backupsManager.deleteBackups());
}
