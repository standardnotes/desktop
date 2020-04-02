import { app, remote, ipcMain, App } from 'electron';
import fs from 'fs';
import path from 'path';
import { Language } from './spellcheckerManager';
import { isTesting } from './utils';
import { TestIpcMessages } from '../../../test/TestIpcMessages';

function logError(...message: any) {
  console.error('store:', ...message);
}

export enum StoreKeys {
  ExtServerHost = 'extServerHost',
  UseSystemMenuBar = 'useSystemMenuBar',
  MenuBarVisible = 'isMenuBarVisible',
  BackupsLocation = 'backupsLocation',
  BackupsDisabled = 'backupsDisabled',
  MinimizeToTray = 'minimizeToTray',
  ZoomFactor = 'zoomFactor',
  SelectedSpellCheckerLanguageCodes = 'selectedSpellCheckerLanguageCodes'
}

interface StoreData {
  [StoreKeys.ExtServerHost]: string | null;
  [StoreKeys.UseSystemMenuBar]: boolean;
  [StoreKeys.MenuBarVisible]: boolean;
  [StoreKeys.BackupsLocation]: string;
  [StoreKeys.BackupsDisabled]: boolean;
  [StoreKeys.MinimizeToTray]: boolean;
  [StoreKeys.ZoomFactor]: number;
  [StoreKeys.SelectedSpellCheckerLanguageCodes]: Set<Language> | null;
}

function createSanitizedStoreData(data: any = {}): StoreData {
  return {
    [StoreKeys.MenuBarVisible]:
      typeof data[StoreKeys.MenuBarVisible] === 'boolean'
        ? data[StoreKeys.MenuBarVisible]
        : true,
    [StoreKeys.UseSystemMenuBar]:
      typeof data[StoreKeys.UseSystemMenuBar] === 'boolean'
        ? data[StoreKeys.UseSystemMenuBar]
        : false,
    [StoreKeys.BackupsDisabled]:
      typeof data[StoreKeys.BackupsDisabled] === 'boolean'
        ? data[StoreKeys.BackupsDisabled]
        : false,
    [StoreKeys.MinimizeToTray]:
      typeof data[StoreKeys.MinimizeToTray] === 'boolean'
        ? data[StoreKeys.MinimizeToTray]
        : false,
    [StoreKeys.ExtServerHost]:
      typeof data[StoreKeys.ExtServerHost] === 'string'
        ? data[StoreKeys.ExtServerHost]
        : undefined,
    [StoreKeys.BackupsLocation]: sanitizeBackupsLocation(
      data[StoreKeys.BackupsLocation]
    ),
    [StoreKeys.ZoomFactor]: sanitizeZoomFactor(data[StoreKeys.ZoomFactor]),
    [StoreKeys.SelectedSpellCheckerLanguageCodes]: sanitizeSpellCheckerLanguageCodes(
      data[StoreKeys.SelectedSpellCheckerLanguageCodes]
    )
  };
}

function sanitizeZoomFactor(factor?: any): number {
  if (typeof factor === 'number' && factor > 0) {
    return factor;
  } else {
    return 1;
  }
}

function sanitizeBackupsLocation(location?: unknown): string {
  const defaultPath = path.join(
    (app || remote.app).getPath('home'),
    'Standard Notes Backups'
  );
  if (typeof location !== 'string') {
    return defaultPath;
  }
  try {
    const stat = fs.lstatSync(location);
    if (stat.isDirectory()) {
      return location;
    }
    return defaultPath;
  } catch (e) {
    logError(e);
    return defaultPath;
  }
}

function sanitizeSpellCheckerLanguageCodes(
  languages?: unknown
): Set<Language> | null {
  if (!languages) return null;
  if (!Array.isArray(languages)) return null;

  const set = new Set<Language>();
  const validLanguages = Object.values(Language);
  for (const language of languages) {
    if (validLanguages.includes(language)) {
      set.add(language);
    }
  }
  return set;
}

export function serializeStoreData(data: StoreData): string {
  return JSON.stringify(data, (_key, value) => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  });
}

function parseDataFile(filePath: string) {
  try {
    const fileData = fs.readFileSync(filePath);
    const userData = JSON.parse(fileData.toString());
    return createSanitizedStoreData(userData);
  } catch (error) {
    logError(error);
    return createSanitizedStoreData({});
  }
}

export class Store {
  static instance: Store;
  readonly path: string;
  readonly data: StoreData;

  static getInstance() {
    if (!this.instance) {
      /**
       * Renderer process has to get `app` module via `remote`, whereas the main process
       * can get it directly app.getPath('userData') will return a string of the user's
       * app data directory path.
       * TODO(baptiste): stop using Store in the renderer process.
       */
      const userDataPath = (app || remote.app).getPath('userData')
      this.instance = new Store(userDataPath);
    }
    return this.instance;
  }

  static get(key: StoreKeys) {
    return this.getInstance().get(key);
  }

  constructor(userDataPath: string) {
    this.path = path.join(userDataPath, 'user-preferences.json');
    this.data = parseDataFile(this.path);

    if (isTesting()) {
      /** Set up test utility methods. */
      ipcMain.handle(TestIpcMessages.StoreData, () =>
        serializeStoreData(this.data)
      );
      ipcMain.handle(TestIpcMessages.StoreSettingsLocation, () => this.path);
      ipcMain.handle(TestIpcMessages.StoreSet, (_e, key, value) => {
        this.set(key, value)
      });
    }
  }

  get<T extends keyof StoreData>(key: T): StoreData[T] {
    return this.data[key];
  }

  set<T extends keyof StoreData>(key: T, val: StoreData[T]) {
    this.data[key] = val;
    fs.writeFileSync(this.path, serializeStoreData(this.data));
  }
}
