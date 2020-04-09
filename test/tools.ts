import electronBinary, { MenuItem } from 'electron';
import { promises as fs } from 'fs';
import { Suite } from 'mocha';
import path from 'path';
import { Application } from 'spectron';
import {
  deleteDir,
  ensureDirectoryExists,
} from '../app/javascripts/main/fileUtils';
import { Language } from '../app/javascripts/main/spellcheckerManager';
import { StoreKeys } from '../app/javascripts/main/store';
import { initializeStrings } from '../app/javascripts/main/strings';
import { UpdateSettings } from '../app/javascripts/main/updateManager';
import { CommandLineArgs } from '../app/javascripts/shared/CommandLineArgs';
import { IpcMessages } from '../app/javascripts/shared/ipcMessages';
import { TestIpcMessages } from './TestIpcMessages';

export function timeout(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function setDefaults(suite: Suite) {
  suite.timeout('20s');
  suite.slow('12s');
}

let app: Application;
const tmpDirPath = path.join(__dirname, 'data', 'tmp');

function invokeIPC(
  message: TestIpcMessages | IpcMessages,
  ...args: any
): Promise<any> {
  return app!.electron.ipcRenderer.invoke(message, ...args);
}

function storeDataLocation() {
  return app.electron.ipcRenderer.invoke(TestIpcMessages.StoreSettingsLocation);
}

export const tools = {
  get app() {
    return app;
  },
  async launchApp({ testing = true } = {}) {
    app = new Application({
      /**
       * The type definition for `path` is incorrect. We need to pass
       * the electron binary for everything to work.
       */
      path: (electronBinary as unknown) as string,
      args: [
        /**
         * Tells spectron to look for and use the package.json file
         * located 1 level above.
         */
        path.join(__dirname, '..'),
        '--icon',
        '_icon/icon.png',
        ...(testing ? [CommandLineArgs.Testing] : []),
      ],
    });
    await app.start();
  },
  async stopApp() {
    await app.stop();
  },

  strings: {
    initialize() {
      try {
        initializeStrings('en');
      } catch (ignored) {
        /** Must have been called already. */
      }
    },
  },
  tmpDir: {
    path: tmpDirPath,
    async make(): Promise<string> {
      await ensureDirectoryExists(tmpDirPath);
      return tmpDirPath;
    },
    async remove() {
      await deleteDir(tmpDirPath);
    },
  },
  paths: {
    userData(): Promise<string> {
      return invokeIPC(TestIpcMessages.UserDataPath);
    },
    updates(): Promise<string> {
      return invokeIPC(TestIpcMessages.UpdateSettingsPath);
    },
  },
  store: {
    diskLocation: storeDataLocation,
    async diskData(): Promise<{ [key in StoreKeys]: any }> {
      const location = await storeDataLocation();
      return JSON.parse((await fs.readFile(location)).toString());
    },
  },
  appMenu: {
    items(): Promise<MenuItem[]> {
      return invokeIPC(TestIpcMessages.AppMenuItems);
    },
    clickLanguage(language: Language) {
      return invokeIPC(TestIpcMessages.ClickLanguage, language);
    },
  },
  spellchecker: {
    manager() {
      return invokeIPC(TestIpcMessages.SpellCheckerManager);
    },
    languages(): Promise<string[]> {
      return invokeIPC(TestIpcMessages.SpellCheckerLanguages);
    },
  },
  updates: {
    settings(): Promise<UpdateSettings> {
      return invokeIPC(TestIpcMessages.UpdateSettings);
    },
    check() {
      return invokeIPC(TestIpcMessages.CheckForUpdate);
    },
    menuReloadTriggered(): Promise<boolean> {
      return invokeIPC(TestIpcMessages.UpdateManagerTriggeredMenuReload);
    },
  },
  backups: {
    enabled(): Promise<boolean> {
      return invokeIPC(TestIpcMessages.BackupsAreEnabled);
    },
    toggleEnabled() {
      return invokeIPC(TestIpcMessages.ToggleBackupsEnabled);
    },
    location() {
      return invokeIPC(TestIpcMessages.BackupsLocation);
    },
    changeLocation(location: string) {
      return invokeIPC(TestIpcMessages.ChangeBackupsLocation, location);
    },
    save(data: any) {
      app.electron.ipcRenderer.send(IpcMessages.DataArchive, data);
    },
    perform() {
      return invokeIPC(TestIpcMessages.PerformBackup);
    },
  },
  setZoomFactor(factor: number) {
    return invokeIPC(TestIpcMessages.StoreSet, 'zoomFactor', factor);
  },
};
