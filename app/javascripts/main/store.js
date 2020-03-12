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
  ZoomFactor: 'zoomFactor',
  /**
   * @type {Set<String> | null} a set of language codes.
   */
  SelectedSpellCheckerLanguageCodes: 'selectedSpellCheckerLanguageCodes'
};

export class Store {
  static instance = null;

  static getInstance() {
    if (!this.instance) {
      this.instance = new Store({
        configName: 'user-preferences',
        defaults: {
          [StoreKeys.UseSystemMenuBar]: false,
          [StoreKeys.MenuBarVisible]: true,
          /**
           * `null` indicates that no language has ever been set. An empty
           * set indicates a user intentionally deselecting every language
           */
          [StoreKeys.SelectedSpellCheckerLanguageCodes]: null
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
    fs.writeFileSync(this.path, JSON.stringify(this.data, (_key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }));
  }
}

function parseDataFile(filePath, defaults) {
  try {
    const userData = JSON.parse(fs.readFileSync(filePath));

    /** Convert spellchecker language codes array into a set. */
    if (userData[StoreKeys.SelectedSpellCheckerLanguageCodes]) {
      userData[StoreKeys.SelectedSpellCheckerLanguageCodes] = new Set(
        userData[StoreKeys.SelectedSpellCheckerLanguageCodes]
      );
    }

    return {
      ...defaults,
      ...userData
    };
  } catch (error) {
    return defaults;
  }
}
