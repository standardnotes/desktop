const electron = require('electron');
const path = require('path');
const fs = require('fs');

export const StoreKeys = {
  ExtServerHost: 'extServerHost',
  UseSystemMenuBar: 'useSystemMenuBar',
  MenuBarVisible: 'isMenuBarVisible',
  BackupsLocation: 'backupsLocation',
  BackupsDisabled: 'backupsDisabled',
  MinimizeToTray: 'minimizeToTray',
  ZoomFactor: 'zoomFactor'
};

export class Store {
  static instance = null;

  static getInstance() {
    if (!this.instance) {
      this.instance = new Store({
        configName: 'user-preferences',
        defaults: {
          [StoreKeys.UseSystemMenuBar]: false,
          [StoreKeys.MenuBarVisible]: true
        }
      });
    }

    return this.instance;
  }

  static get(key) {
    return this.getInstance().get(key);
  }

  static set(key, val) {
    return this.getInstance().set(key, val);
  }

  constructor(opts) {
    /** 
     * Renderer process has to get `app` module via `remote`, whereas the main process 
     * can get it directly app.getPath('userData') will return a string of the user's 
     * app data directory path.
     */ 
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    this.path = path.join(userDataPath, opts.configName + '.json');
    this.data = parseDataFile(this.path, opts.defaults);
  }

  get(key) {
    return this.data[key];
  }

  set(key, val) {
    this.data[key] = val;
    fs.writeFileSync(this.path, JSON.stringify(this.data));
  }
}

function parseDataFile(filePath, defaults) {
  try {
    const userData = JSON.parse(fs.readFileSync(filePath));
    return Object.assign(defaults, userData);
  } catch(error) {
    return defaults;
  }
}
