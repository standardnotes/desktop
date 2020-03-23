import electron from 'electron';
import fs from 'fs';
import path from 'path';

export enum StoreKeys {
  ExtServerHost = 'extServerHost',
  UseSystemMenuBar = 'useSystemMenuBar',
  MenuBarVisible = 'isMenuBarVisible',
  BackupsLocation = 'backupsLocation',
  BackupsDisabled = 'backupsDisabled',
  MinimizeToTray = 'minimizeToTray',
  ZoomFactor = 'zoomFactor',
  /**
   * @type {Set<String> | null} a set of language codes.
   */
  SelectedSpellCheckerLanguageCodes = 'selectedSpellCheckerLanguageCodes'
};

type StoreData = {
  [key in StoreKeys]?: any;
};

export class Store {
  static instance: Store;
  readonly path: string;
  readonly data: StoreData;

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

  static get(key: StoreKeys) {
    return this.getInstance().get(key);
  }

  static set(key: StoreKeys, val: any) {
    return this.getInstance().set(key, val);
  }

  constructor(opts: { configName: string; defaults: StoreData }) {
    /**
     * Renderer process has to get `app` module via `remote`, whereas the main process
     * can get it directly app.getPath('userData') will return a string of the user's
     * app data directory path.
     */
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    this.path = path.join(userDataPath, opts.configName + '.json');
    this.data = parseDataFile(this.path, opts.defaults);
  }

  get(key: StoreKeys) {
    return this.data[key];
  }

  set(key: StoreKeys, val: any) {
    this.data[key] = val;
    fs.writeFileSync(this.path, JSON.stringify(this.data, (_key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    }));
  }
}

function parseDataFile(filePath: string, defaults: StoreData) {
  try {
    const userData = JSON.parse(fs.readFileSync(filePath).toString());

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
