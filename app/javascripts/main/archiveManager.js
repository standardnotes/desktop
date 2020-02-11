import { Store, StoreKeys } from './store';
const {ipcMain, dialog, app} = require('electron');
var fs = require('fs');
var path = require('path');
export class ArchiveManager {
  constructor(window) {
    this.window = window;
    ipcMain.on('data-archive', (event, data) => {
      this.writeDataToFile(data, error => {
        this.window.webContents.send("finished-saving-backup", {
          success: error === null
        });
      });
    });

    this.backupsLocation = Store.get(StoreKeys.BackupsLocation);
    this.backupsDisabled = Store.get(StoreKeys.BackupsDisabled);
  }

  applicationDidBlur() {
    if(this.needsBackup) {
      this.needsBackup = false;
      this.performBackup();
    }
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
      const path = paths[0];
      this.backupsLocation = path;
      Store.set(StoreKeys.BackupsLocation, path);
      this.performBackup();
    });
  }

  writeDataToFile(data, callback) {
    if(this.backupsDisabled) {
      console.log("Backups are disabled; returning.");
      return;
    }

    // We want to create this directory, even if data is empty,
    // just so it's there and the user can open it.
    const dir = this.getBackupsLocation();
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
    const name = (new Date()).toISOString().replace(re, "-") + ".txt";

    const filePath = path.join(dir, name);

    fs.writeFile(filePath, data, (err) => {
      if(err){
        console.log("An error ocurred saving backup file: " + err.message);
      } else {
        console.log("Data backup succesfully saved: ", name);
      }
      callback(err);
    });
  }

  beginBackups() {
    if(this.interval) {
      clearInterval(this.interval);
    }

    // Instead of performing a backup on app launch,
    // which drastically slows down performance, wait until window blurs
    this.needsBackup = true;
    const hoursInterval = 12; // Every X hours
    const seconds = hoursInterval * 60 * 60;
    const milliseconds = seconds * 1000;
    this.interval = setInterval(() => {
      this.performBackup();
    }, milliseconds);
  }

  performBackup() {
    if(this.backupsDisabled) {
      console.log("Backups are disabled; returning.");
      return;
    }
    this.window.webContents.send("download-backup");
  }

  isBackupsEnabled() {
    return !this.backupsDisabled;
  }

  toggleBackupsStatus() {
    this.backupsDisabled = !this.backupsDisabled;
    Store.set(StoreKeys.BackupsDisabled, this.backupsDisabled);
  }
}
