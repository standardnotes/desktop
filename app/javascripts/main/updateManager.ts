import path from 'path';
import { readJSONFile, writeJSONFile, FileDoesNotExist } from './fileUtils';
import { downloadFile, getJSON } from './networking';
import { updates as str } from './strings';
import { InstallerKey, installerKey } from './platforms';
import { dialog, app, shell, App, BrowserWindow } from 'electron';
import compareVersions from 'compare-versions';
import { autoUpdater } from 'electron-updater';
import electronLog from 'electron-log';

const DefaultUpdateEndpoint =
  process.env.UPDATE_ENDPOINT ||
  'https://standardnotes.org/desktop/latest.json';

const appPath = app.getPath('userData');
const folderPath = path.join(appPath, 'Updates');
const settingsFilePath = path.join(folderPath, 'settings.json');

function log(...message: any) {
  console.log('updateManager:', ...message);
}

function logError(...message: any) {
  console.error('updateManager:', ...message);
}

interface LatestUpdate {
  version: string;
  changelog: string;
  downloads: Record<InstallerKey, string>;
}

interface UpdateSettings {
  endpoint: string;
  autoupdateEnabled: boolean;

  manualUpdateDownloaded?: boolean;
  lastCheck?: Date;
  latest?: LatestUpdate;
}
async function updateSettingsFromDisk(settings: UpdateSettings) {
  try {
    const data = await readJSONFile(settingsFilePath);
    Object.assign(settings, data);
  } catch (error) {
    logError(error);
  }
}
function updateSettings(
  settings: UpdateSettings,
  props: Partial<UpdateSettings>
) {
  Object.assign(settings, props);
  /** Save settings to disk */
  writeJSONFile(settingsFilePath, settings);
}

export interface UpdateManager {
  onNeedMenuReload?: () => void;

  currentVersion: string;
  latestVersion?: string;
  lastCheck?: Date;

  checkForUpdate(arg?: { userTriggered: boolean }): void;
  checkingForUpdate: boolean;

  updateNeeded(): boolean;

  downloadUpdateFile(): void;
  downloadingUpdate: boolean;
  openDownloadLocation(): void;

  autoUpdateEnabled: boolean;
  autoUpdateDownloaded: boolean;
  showAutoUpdateInstallationDialog(): void;
  autoUpdateDownloadedVersion(): string;
  toggleAutoupdateStatus(): void;
  manualUpdateDownloaded: boolean;

  openChangelog(): void;
}

export function createUpdateManager(window: BrowserWindow): UpdateManager {
  let settings: UpdateSettings = {
    endpoint: DefaultUpdateEndpoint,
    autoupdateEnabled: false
  };
  const currentVersion = app.getVersion();
  let checkingForUpdate = false;
  let downloadingUpdate = false;
  let autoUpdateDownloaded = false;
  let autoupdateVersion: string | undefined;
  let onNeedMenuReload: (() => void) | undefined;

  updateSettingsFromDisk(settings).then(() => checkForUpdate());
  setupAutoUpdater();

  function setupAutoUpdater() {
    autoUpdater.logger = electronLog;

    autoUpdater.on('update-downloaded', (info: { version: string }) => {
      window.webContents.send('update-available', null);
      autoUpdateDownloaded = true;
      autoupdateVersion = info.version;
      triggerMenuReload();
    });
  }

  function triggerMenuReload() {
    onNeedMenuReload?.();
  }

  async function checkForAutoUpdate(force = false) {
    if (process.env.NODE_ENV === 'development') return;

    if (settings.autoupdateEnabled || force) {
      try {
        await autoUpdater.checkForUpdates();
      } catch (e) {
        logError('Exception caught while checking for autoupdates:', e);
      }
    }
  }

  async function checkForUpdate({ userTriggered = false } = {}) {
    log('Checking for updates.');

    checkForAutoUpdate(userTriggered);
    checkingForUpdate = true;
    triggerMenuReload();
    try {
      const latest: LatestUpdate = await getJSON(settings.endpoint);
      updateSettings(settings, {
        latest,
        lastCheck: new Date()
      });

      log(
        'Finished checking for updates. Latest version:\n ' +
          `${latest.version} Current version: ${currentVersion}`
      );

      if (userTriggered) {
        let message;
        if (updateNeeded()) {
          message = str().finishedChecking.updateAvailable(latest.version);
        } else {
          message = str().finishedChecking.noUpdateAvailable(currentVersion);
        }

        dialog.showMessageBox({
          title: str().finishedChecking.title,
          message
        });
      }
    } catch (error) {
      logError(error);
      dialog.showMessageBox({
        title: str().finishedChecking.title,
        message: str().finishedChecking.error(JSON.stringify(error))
      });
    } finally {
      checkingForUpdate = false;
      triggerMenuReload();
    }
  }

  function updateNeeded() {
    return (
      settings.latest &&
      compareVersions(settings.latest.version, currentVersion) === 1
    );
  }

  function openChangelog() {
    const url = settings.latest?.changelog;
    if (url) {
      shell.openExternal(url);
    }
  }

  function openDownloadLocation() {
    shell.openItem(folderPath);
  }

  return {
    currentVersion,
    checkForUpdate,
    openDownloadLocation,
    openChangelog,
    get autoUpdateDownloaded() {
      return autoUpdateDownloaded;
    },
    get lastCheck() {
      return settings.lastCheck;
    },
    get latestVersion() {
      return settings.latest?.version;
    },
    get checkingForUpdate() {
      return checkingForUpdate;
    },
    get autoUpdateEnabled() {
      return settings.autoupdateEnabled;
    },
    get downloadingUpdate() {
      return downloadingUpdate;
    },
    get manualUpdateDownloaded() {
      return settings.manualUpdateDownloaded ?? false;
    },
    set onNeedMenuReload(fn: () => void) {
      onNeedMenuReload = fn;
    },
    autoUpdateDownloadedVersion() {
      return autoupdateVersion ?? str().unknownVersionName;
    },
    async showAutoUpdateInstallationDialog() {
      if (!autoupdateVersion) return;
      const result = await dialog.showMessageBox({
        type: 'info',
        title: str().updateReady.title,
        message: str().updateReady.message(autoupdateVersion),
        buttons: [
          str().updateReady.quitAndInstall,
          str().updateReady.installLater
        ]
      });

      const buttonIndex = result.response;
      if (buttonIndex === 0) {
        setImmediate(() => {
          // index.js prevents close event on some platforms
          window.removeAllListeners('close');
          window.close();
          autoUpdater.quitAndInstall(false);
        });
      }
    },
    updateNeeded(): boolean {
      if (!settings.latest) return false;
      return compareVersions(settings.latest.version, app.getVersion()) === 1;
    },
    toggleAutoupdateStatus() {
      updateSettings(settings, {
        autoupdateEnabled: !settings.autoupdateEnabled
      });
      triggerMenuReload();

      if (settings.autoupdateEnabled) {
        dialog.showMessageBox({
          title: str().automaticUpdatesEnabled.title,
          message: str().automaticUpdatesEnabled.message
        });
      }
    },
    async downloadUpdateFile() {
      const url = settings.latest?.downloads?.[installerKey];
      if (!url) {
        // Open GitHub releases
        openChangelog();
        return;
      }

      try {
        downloadingUpdate = true;
        triggerMenuReload();
        const filename = url.split('/').pop();
        if (!filename) throw new Error(`Invalid url: ${url}`);
        const filePath = path.join(folderPath, filename);
        log('Downloading update file', url);

        await downloadFile(url, filePath);
        updateSettings(settings, { manualUpdateDownloaded: true });
        openDownloadLocation();
      } catch (error) {
        dialog.showMessageBox({
          title: str().errorDownloading.title,
          message: str().errorDownloading.message
        });
      } finally {
        downloadingUpdate = false;
        triggerMenuReload();
      }
    }
  };
}
