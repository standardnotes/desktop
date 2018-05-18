var {ipcMain, remote, dialog, app} = require('electron');
const shell = require('electron').shell;
var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var os = require('os');
var request = require("request");
var appPath = app.getPath('userData');
var compareVersions = require('compare-versions');
const {autoUpdater} = require("electron-updater");
const log = require('electron-log');
const isDev = require('electron-is-dev');

import fileUtils from "./fileUtils";

let UpdateFoldersName = "Updates";
let DefaultUpdateEndpoint = process.env.UPDATE_ENDPOINT || "https://standardnotes.org/desktop/latest.json";

class UpdateManager {

  constructor() {
    this.metadata = {};
    this.getUpdateInfoFile((data) => {
      if(!data) {
        data = {endpoint: DefaultUpdateEndpoint, autoupdateEnabled: true};
      }
      this.metadata = data;
      this.checkForUpdate();
    })

    autoUpdater.logger = log

    autoUpdater.on("update-downloaded", (info) => {
      this.window.webContents.send("update-available", null);
      this.__autoupdateDownloaded = true;
      this.autoupdateInfo = info;
      this.triggerMenuReload();
    })
  }

  setWindow(window) {
    this.window = window;
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
      buttons: ['Quit & Install', 'Install Later']
    }, (buttonIndex) => {
      if (buttonIndex === 0) {
        setImmediate(() => {
          // index.js prevents close event on some platforms
          this.window.removeAllListeners("close");
          this.window.close();
          autoUpdater.quitAndInstall(false)
        })
      }
      else {
        autoUpdater.enabled = true
      }
    })
  }

  getMetadata() {
    return this.metadata;
  }

  updateNeeded() {
    return this.metadata.latest && compareVersions(this.metadata.latest.version, app.getVersion()) == 1;
  }

  autoupdateEnabled() {
    return this.metadata.autoupdateEnabled;
  }

  toggleAutoupdateStatus() {
    this.metadata.autoupdateEnabled = !this.metadata.autoupdateEnabled;
    this.saveInfoFile();
    this.triggerMenuReload();

    if(this.metadata.autoupdateEnabled) {
      dialog.showMessageBox({title: "Automatic Updates Enabled.", message: "Automatic updates have been enabled. Please note that this functionality is currently in beta, and that you are advised to periodically check in and ensure you are running the latest version."});
    }
  }

  latestVersion() {
    return this.metadata.latest && this.metadata.latest.version;
  }

  __checkAutoupdate() {
    if(isDev || !this.metadata.autoupdateEnabled) { return; }
    try {
      autoUpdater.checkForUpdates();
    } catch (e) {
      console.log("Exception caught while checking for autoupdates:", e);
    }
  }

  checkForUpdate(options = {}) {

    console.log("Checking for updates...");

    this.__checkAutoupdate();

    this.metadata.checkingForUpdate = true;
    this.triggerMenuReload();

    let currentVersion = app.getVersion();
    this.__getLatest((latest, error) => {
      if(!latest) { latest = {}; }
      if(latest.version) {
        this.metadata.latest = latest;
      }

      console.log(`Finished checking for updates. Latest version: ${latest.version} Current version: ${currentVersion}`);

      this.metadata.currentVersion = currentVersion;
      this.metadata.checkingForUpdate = false;

      // Update info file with last check
      this.metadata.lastCheck = new Date();

      if(options.userTriggered) {
        var message = this.updateNeeded()
        ? `A new update is available (version ${this.metadata.latest.version}). You can attempt upgrading through auto-update (beta), or manually download and install this update.`
        : `Your version (${this.metadata.currentVersion}) is the latest available version.`;

        if(error) {
          message = "An issue occurred while checking for updates. Please try again.";
        }

        dialog.showMessageBox({title: "Finished checking for updates.", message: message});
      }

      this.triggerMenuReload();

      this.saveInfoFile();
    })
  }

  downloadUpdateFile() {
    var platformKey = this.getPlatformKey();
    if(!platformKey) {
      // Open GitHub releases
      this.openChangelog();
      return;
    }

    this.metadata.downloadingUpdate = true;
    this.triggerMenuReload();

    var url = this.metadata.latest.downloads[platformKey];
    var filename = url.split('/').pop()
    let path = appPath + "/" + UpdateFoldersName + "/" + filename;
    console.log("Downloading update file", url);
    fileUtils.downloadFile(url, path, (error) => {
      this.metadata.downloadingUpdate = false;
      if(!error) {
        this.metadata.latestDownloaded = true;
        this.saveInfoFile();
        this.openDownloadLocation();
      } else {
        dialog.showMessageBox({title: "Error Downloading", message: "An error occurred while trying to download your update file. Please try again."});
      }
      this.triggerMenuReload();
    })
  }

  getPlatformKey() {
    var platformKey;
    // possible remote keys for platforms are: mac, windows, appimage_x86, appimage_x64

    // 'darwin', 'linux', 'openbsd', 'win32'
    var nativePlatform = os.platform();
    if(nativePlatform == "darwin") {
      platformKey = "mac";
    } else if(nativePlatform.includes("win")) {
      platformKey = "windows";
    } else {
      // Linux
      //  possible values are: 'arm', 'arm64', 'ia32', 'x32', and 'x64'.
      var arch = os.arch();
      if(arch == "x64") {
        platformKey = "appimage_64";
      } else {
        platformKey = "appimage_32";
      }
    }
    return platformKey;
  }

  openChangelog() {
    shell.openExternal(this.metadata.latest.changelog);
  }

  openDownloadLocation() {
    shell.openItem(appPath + "/" + UpdateFoldersName);
  }

  triggerMenuReload() {
    this.onNeedMenuReload && this.onNeedMenuReload();
  }

  metaFilePath() {
    let path = appPath + "/" + UpdateFoldersName + "/" + "settings.json";
    return path;
  }

  saveInfoFile() {
    let path = this.metaFilePath();
    fileUtils.writeJSONFile(this.metadata, path, (writeError) => {

    })
  }

  getUpdateInfoFile(callback) {
    // Check for update info file
    let path = this.metaFilePath();
    fileUtils.readJSONFile(path, (data, readError) => {
      callback(data);
    })
  }

  __getLatest(callback) {
    let url = this.metadata.endpoint;
    request.get(url, (error, response, body) => {
      if(response && response.statusCode == 200) {
        callback(JSON.parse(body));
      } else {
        callback(null, error || {});
      }
    })
  }
}

export default new UpdateManager();
