const electron = require('electron');
const path = require('path');
const fs = require('fs');

let instance = null;

class Store {

  static instance() {
    if (instance == null) {
      instance = new Store({
        configName: 'user-preferences',
        defaults: {
          useSystemMenuBar: false,
          isMenuBarVisible: true
        }
      });
    }

    return instance;
  }

  constructor(opts) {
    // Renderer process has to get `app` module via `remote`, whereas the main process can get it directly
    // app.getPath('userData') will return a string of the user's app data directory path.
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    // We'll use the `configName` property to set the file name and path.join to bring it all together as a string
    this.path = path.join(userDataPath, opts.configName + '.json');

    this.data = parseDataFile(this.path, opts.defaults);
  }

  // This will just return the property on the `data` object
  get(key) {
    return this.data[key];
  }

  // ...and this will set it
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
    // if there was some kind of error, return the passed in defaults instead.
    return defaults;
  }
}

// expose the class
module.exports = Store;
