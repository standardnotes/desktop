import compareVersions from 'compare-versions';
import { app, BrowserWindow, dialog, shell } from 'electron';
import electronLog from 'electron-log';
import { autoUpdater } from 'electron-updater';
import { MessageType } from '../../../test/TestIpcMessage';
import { AppState } from '../../application';
import { BackupsManager } from './backupsManager';
import { Store, StoreKeys } from './store';
import { updates as str } from './strings';
import { handle } from './testing';
import { isTesting } from './utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logError(...message: any) {
  console.error('updateManager:', ...message);
}

if (isTesting()) {
  // eslint-disable-next-line no-var
  var notifiedStateUpdate = false;
}

class UpdateManagerState {
  readonly currentVersion = app.getVersion();
  lastCheck?: Date;
  latestVersion?: string;
  checkingForUpdate = false;
  autoUpdateDownloaded = false;
  autoUpdateVersion?: string;
  onStateUpdate?: () => void;
}

export interface UpdateManager {
  readonly latestVersion?: string;
  readonly currentVersion: string;
  readonly lastCheck?: Date;
  readonly autoUpdateEnabled: boolean;
  readonly autoUpdateDownloaded: boolean;
  readonly checkingForUpdate: boolean;
  onStateUpdate?: () => void;
  openChangelog(): void;
  checkForUpdate(userTriggered: boolean): void;
  toggleAutoupdateStatus(): void;
  showAutoUpdateInstallationDialog(): void;
  updateNeeded(): boolean;
}

export function createUpdateManager(
  window: BrowserWindow,
  appState: Pick<AppState, 'store' | 'lastBackupDate'>
): UpdateManager {
  const { store } = appState;
  const state = new UpdateManagerState();

  setupAutoUpdater(window, state);

  if (isTesting()) {
    handle(MessageType.UpdateManagerState, () => state);
    handle(MessageType.AutoUpdateEnabled, () =>
      store.get(StoreKeys.EnableAutoUpdate)
    );
    handle(MessageType.CheckForUpdate, () =>
      checkForUpdate(store, state, false)
    );
    handle(
      MessageType.UpdateManagerNotifiedStateChange,
      () => notifiedStateUpdate
    );
  } else {
    checkForUpdate(store, state);
  }

  return {
    currentVersion: state.currentVersion,
    get autoUpdateDownloaded() {
      return state.autoUpdateDownloaded;
    },
    get checkingForUpdate() {
      return state.checkingForUpdate;
    },
    get lastCheck() {
      return state.lastCheck;
    },
    get latestVersion() {
      return state.latestVersion;
    },
    get autoUpdateEnabled() {
      return autoUpdateEnabled(store);
    },
    set onStateUpdate(fn: () => void) {
      state.onStateUpdate = fn;
    },
    openChangelog() {
      openChangelog(state.latestVersion);
    },
    updateNeeded() {
      return updateNeeded(state);
    },
    showAutoUpdateInstallationDialog() {
      showUpdateInstallationDialog(window, state, appState);
    },
    checkForUpdate(userTriggered: boolean) {
      checkForUpdate(store, state, userTriggered);
    },
    toggleAutoupdateStatus() {
      toggleAutoupdateStatus(store, state);
    },
  };
}

function autoUpdateEnabled(store: Store) {
  return store.get(StoreKeys.EnableAutoUpdate);
}

function setupAutoUpdater(window: BrowserWindow, state: UpdateManagerState) {
  autoUpdater.logger = electronLog;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-downloaded', (info: { version: string }) => {
    window.webContents.send('update-available', null);
    state.autoUpdateDownloaded = true;
    state.autoUpdateVersion = info.version;
    notifyStateUpdate(state);
  });

  autoUpdater.on('error', logError);
  autoUpdater.on('update-available', (info: { version: string }) => {
    state.latestVersion = info.version;
    state.lastCheck = new Date();
    notifyStateUpdate(state);
  });
  autoUpdater.on('update-not-available', (info: { version: string }) => {
    state.latestVersion = info.version;
    state.lastCheck = new Date();
    notifyStateUpdate(state);
  });
}

function openChangelog(latestVersion?: string) {
  const url = 'https://github.com/standardnotes/desktop/releases';
  if (latestVersion) {
    shell.openExternal(`${url}/tag/v${latestVersion}`);
  } else {
    shell.openExternal(url);
  }
}

function toggleAutoupdateStatus(store: Store, state: UpdateManagerState) {
  const enableAutoUpdates = !autoUpdateEnabled(store);
  autoUpdater.autoDownload = enableAutoUpdates;
  store.set(StoreKeys.EnableAutoUpdate, enableAutoUpdates);
  notifyStateUpdate(state);
}

function notifyStateUpdate(state: UpdateManagerState) {
  state.onStateUpdate?.();
  if (isTesting()) {
    notifiedStateUpdate = true;
  }
}

function updateNeeded(state: UpdateManagerState) {
  if (state.latestVersion) {
    return compareVersions(state.latestVersion, state.currentVersion) === 1;
  }
  return false;
}

function quitAndInstall(window: BrowserWindow) {
  setTimeout(() => {
    // index.js prevents close event on some platforms
    window.removeAllListeners('close');
    window.close();
    autoUpdater.quitAndInstall(false);
  }, 0);
}

function isLessThanOneHourFromNow(date: number) {
  const now = Date.now();
  const onHourMs = 1 * 60 * 60 * 1000;
  return now - date < onHourMs;
}
async function showUpdateInstallationDialog(
  parentWindow: BrowserWindow,
  state: UpdateManagerState,
  appState: Pick<AppState, 'lastBackupDate'>
) {
  if (!state.latestVersion) return;
  if (
    appState.lastBackupDate &&
    isLessThanOneHourFromNow(appState.lastBackupDate)
  ) {
    const result = await dialog.showMessageBox(parentWindow, {
      type: 'info',
      title: str().updateReady.title,
      message: str().updateReady.message(state.latestVersion),
      buttons: [
        str().updateReady.installLater,
        str().updateReady.installAndRestart,
      ],
      cancelId: 0,
    });

    const buttonIndex = result.response;
    if (buttonIndex === 1) {
      quitAndInstall(parentWindow);
    }
  } else {
    const cancelId = 0;
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: str().updateReady.title,
      message:
        'An update is ready to install, but your backups folder does not appear to contain a recent enough backup. ' +
        'Please download a backup manually before proceeding with the installation.',
      detail:
        'You can download a backup from the Account menu in the bottom-left corner of the app.',
      checkboxLabel: 'I have downloaded a backup, proceed with installation',
      checkboxChecked: false,
      buttons: [
        str().updateReady.installLater,
        str().updateReady.installAndRestart,
      ],
      cancelId,
    });

    if (!result.checkboxChecked || result.response === cancelId) {
      return;
    }
    quitAndInstall(parentWindow);
  }
}

async function checkForUpdate(
  store: Store,
  state: UpdateManagerState,
  userTriggered = false
) {
  if (store.get(StoreKeys.EnableAutoUpdate) || userTriggered) {
    state.checkingForUpdate = true;
    notifyStateUpdate(state);
    try {
      const { updateInfo } = await autoUpdater.checkForUpdates();
      state.lastCheck = new Date();
      state.latestVersion = updateInfo.version;

      if (userTriggered) {
        let message;
        if (updateNeeded(state)) {
          message = str().finishedChecking.updateAvailable(state.latestVersion);
        } else {
          message = str().finishedChecking.noUpdateAvailable(
            state.currentVersion
          );
        }

        dialog.showMessageBox({
          title: str().finishedChecking.title,
          message,
        });
      }
    } catch (error) {
      logError('Exception caught while checking for autoupdates:', error);
      if (userTriggered) {
        dialog.showMessageBox({
          title: str().finishedChecking.title,
          message: str().finishedChecking.error(JSON.stringify(error)),
        });
      }
    } finally {
      state.checkingForUpdate = false;
      notifyStateUpdate(state);
    }
  }
}
