var {ipcMain, remote, dialog, app} = require('electron');
var fs = require('fs');
var path = require('path');
const Store = require('./store.js');

const store = new Store({
  configName: 'user-preferences',
  defaults: {}
});

class ArchiveManager {

  constructor() {
    ipcMain.on('data-archive', (event, data) => {
      this.writeDataToFile(data, (success) => {
        this.window.webContents.send("finished-saving-backup", {success: success});
      });
    });

    this.backupsLocation = store.get("backupsLocation");
    this.backupsDisabled = store.get("backupsDisabled");
  }

  defaultLocation() {
    return path.join(app.getPath('home'), "Standard Notes Backups");
  }

  getBackupsLocation() {
    if(!this.backupsLocation) {
      this.backupsLocation = this.defaultLocation();
    }
    return this.backupsLocation;
  }

  changeBackupsLocation() {
    dialog.showOpenDialog({
       properties: ['openDirectory', 'showHiddenFiles', 'createDirectory']
    }, (paths) => {
      let path = paths[0];
      this.backupsLocation = path;
      store.set("backupsLocation", path);
      this.performBackup();
    })
  }

  writeDataToFile(data, callback) {
    if(this.backupsDisabled) {
      console.log("Backups are disabled; returning.")
      return;
    }

    // We want to create this directory, even if data is empty,
    // just so it's there and the user can open it.
    let dir = this.getBackupsLocation();
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }

    // Return on empty after creating directory
    if(!data) {
      console.log("Empty data, not writing backup file.");
      return;
    }

    var find = ':';
    var re = new RegExp(find, 'g');
    let name = (new Date()).toISOString().replace(re, "-") + ".txt";

    let filePath = path.join(dir, name);

    fs.writeFile(filePath, data, (err) => {
      if(err){
        console.log("An error ocurred saving backup file: " + err.message)
      } else {
        console.log("Data backup succesfully saved: ", name);
      }
      callback(err == null);
    });
  }

  setWindow(window) {
    this.window = window;
  }

  beginBackups() {
    if(this.interval) {
      clearInterval(this.interval);
    }

    this.performBackup();

    let hoursInterval = 12; // Every X hours
    let seconds = hoursInterval * 60 * 60;
    let milliseconds = seconds * 1000;
    this.interval = setInterval(() => {
      this.performBackup();
    }, milliseconds);
  }

  performBackup() {
    if(this.backupsDisabled) {
      console.log("Backups are disabled; returning.")
      return;
    }
    this.window.webContents.send("download-backup");
  }

  isBackupsEnabled() {
    return !this.backupsDisabled;
  }

  toggleBackupsStatus() {
    this.backupsDisabled = !this.backupsDisabled;
    store.set("backupsDisabled", this.backupsDisabled);
  }

}

export default new ArchiveManager();
