import { readJSONFile, writeJSONFile } from './fileUtils';
import { downloadFile } from './networking';
const { dialog, app } = require('electron');
const shell = require('electron').shell;
const os = require('os');
const request = require('request');
const appPath = app.getPath('userData');
const compareVersions = require('compare-versions');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const isDev = require('electron-is-dev');

const UpdateFoldersName = 'Updates';
const DefaultUpdateEndpoint = process.env.UPDATE_ENDPOINT ||
  'https://standardnotes.org/desktop/latest.json';

export class UpdateManager {

  constructor(window) {
    this.window = window;
    this.metadata = {};
    this.onNeedMenuReload = null;

    this.getUpdateInfoFile().then((data) => {
      if (!data) {
        data = {
          endpoint: DefaultUpdateEndpoint,
          autoupdateEnabled: true
        };
      }
      this.metadata = data;
      this.checkForUpdate();
    }).catch(console.error);

    autoUpdater.logger = log;

    autoUpdater.on('update-downloaded', (info) => {
      this.window.webContents.send('update-available', null);
      this.__autoupdateDownloaded = true;
      this.autoupdateInfo = info;
      this.triggerMenuReload();
    });
  }

  autoupdateDownloaded() {
    return this.__autoupdateDownloaded;
  }

  autoupdateDownloadedVersion() {
    return this.autoupdateInfo.version;
  }

  installAutoupdateNow() {
    var info = this.autoupdateInfo;
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `A new update (version ${info.version}) is ready to install.`,
      buttons: ['Quit and Install', 'Install Later']
    }, (buttonIndex) => {
      if (buttonIndex === 0) {
        setImmediate(() => {
          // index.js prevents close event on some platforms
          this.window.removeAllListeners('close');
          this.window.close();
          autoUpdater.quitAndInstall(false);
        });
      }
      else {
        autoUpdater.enabled = true;
      }
    });
  }

  getMetadata() {
    return this.metadata;
  }

  updateNeeded() {
    return this.metadata.latest &&
      compareVersions(this.metadata.latest.version, app.getVersion()) === 1;
  }

  autoupdateEnabled() {
    return this.metadata.autoupdateEnabled;
  }

  toggleAutoupdateStatus() {
    this.metadata.autoupdateEnabled = !this.metadata.autoupdateEnabled;
    this.saveInfoFile();
    this.triggerMenuReload();

    if (this.metadata.autoupdateEnabled) {
      dialog.showMessageBox({
        title: 'Automatic Updates Enabled.',
        message: `Automatic updates have been enabled. Please note that this functionality
           is currently in beta, and that you are advised to periodically check in and
           ensure you are running the latest version.`
      });
    }
  }

  latestVersion() {
    return this.metadata.latest && this.metadata.latest.version;
  }

  __checkAutoupdate() {
    if (isDev || !this.metadata.autoupdateEnabled) { return; }
    try {
      autoUpdater.checkForUpdates();
    } catch (e) {
      console.log('Exception caught while checking for autoupdates:', e);
    }
  }

  checkForUpdate(options = {}) {

    console.log('Checking for updates...');

    this.__checkAutoupdate();
    this.metadata.checkingForUpdate = true;
    this.triggerMenuReload();
    const currentVersion = app.getVersion();
    this.__getLatest((latest, error) => {
      if (!latest) { latest = {}; }
      if (latest.version) {
        this.metadata.latest = latest;
      }

      console.log(`Finished checking for updates. Latest version:
        ${latest.version} Current version: ${currentVersion}`);

      this.metadata.currentVersion = currentVersion;
      this.metadata.checkingForUpdate = false;

      // Update info file with last check
      this.metadata.lastCheck = new Date();

      if (options.userTriggered) {
        var message = this.updateNeeded()
          ? `A new update is available (version ${this.metadata.latest.version}).
            You can attempt upgrading through auto-update, or manually download and install this update.`
          : `Your version (${this.metadata.currentVersion}) is the latest available version.`;

        if (error) {
          message = 'An issue occurred while checking for updates. Please try again.';
        }

        dialog.showMessageBox({
          title: 'Finished checking for updates.',
          message: message
        });
      }

      this.triggerMenuReload();
      this.saveInfoFile();
    });
  }

  async downloadUpdateFile() {
    const platformKey = this.getPlatformKey();
    if (!platformKey) {
      // Open GitHub releases
      this.openChangelog();
      return;
    }

    this.metadata.downloadingUpdate = true;
    this.triggerMenuReload();

    const url = this.metadata.latest.downloads[platformKey];
    const filename = url.split('/').pop();
    const path = appPath + '/' + UpdateFoldersName + '/' + filename;
    console.log('Downloading update file', url);
    try {
      await downloadFile(url, path);
      this.metadata.latestDownloaded = true;
      this.saveInfoFile();
      this.openDownloadLocation();
    } catch (error) {
      dialog.showMessageBox({
        title: 'Error Downloading',
        message: 'An error occurred while trying to download your update file. Please try again.'
      });
    } finally {
      this.metadata.downloadingUpdate = false;
      this.triggerMenuReload();
    }
  }

  getPlatformKey() {
    /* mac, windows, appimage_x86, appimage_x64 */
    let platformKey;
    /* 'darwin', 'linux', 'openbsd', 'win32' */
    const nativePlatform = os.platform();
    if (nativePlatform === 'darwin') {
      platformKey = 'mac';
    } else if (nativePlatform.includes('win')) {
      platformKey = 'windows';
    } else {
      /* Linux; possible values are: 'arm', 'arm64', 'ia32', 'x32', and 'x64'. */
      const arch = os.arch();
      if (arch === 'x64') {
        platformKey = 'appimage_64';
      } else {
        platformKey = 'appimage_32';
      }
    }
    return platformKey;
  }

  openChangelog() {
    shell.openExternal(this.metadata.latest.changelog);
  }

  openDownloadLocation() {
    shell.openItem(appPath + '/' + UpdateFoldersName);
  }

  triggerMenuReload() {
    this.onNeedMenuReload && this.onNeedMenuReload();
  }

  metaFilePath() {
    return appPath + '/' + UpdateFoldersName + '/' + 'settings.json';
  }

  async saveInfoFile() {
    await writeJSONFile(this.metaFilePath(), this.metadata);
  }

  async getUpdateInfoFile() {
    // Check for update info file
    const path = this.metaFilePath();
    return readJSONFile(path);
  }

  __getLatest(callback) {
    const url = this.metadata.endpoint;
    request.get(url, (error, response, body) => {
      if (response && response.statusCode === 200) {
        callback(JSON.parse(body));
      } else {
        callback(null, error || {});
      }
    });
  }
}
