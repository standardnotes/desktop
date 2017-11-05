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
      if(data) {
        this.writeDataToFile(data);
      } else {
        console.log("Empty data, not writing.");
      }
    });

    this.backupsLocation = store.get("backupsLocation");
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

  writeDataToFile(data) {
    let dir = this.getBackupsLocation();
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }

    var find = ':';
    var re = new RegExp(find, 'g');
    let name = (new Date()).toString().replace(re, "-") + ".txt";

    let filePath = path.join(dir, name);

    fs.writeFile(filePath, data, (err) => {
        if(err){
          console.log("An error ocurred creating the file "+ err.message)
        } else {
          console.log("The file has been succesfully saved");
        }
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
    this.window.webContents.send("download-backup");
  }

}

export default new ArchiveManager();
