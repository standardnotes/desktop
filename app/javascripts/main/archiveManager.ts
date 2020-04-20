import {
  dialog,
  IpcMain,
  WebContents
} from 'electron';
import fs from 'fs';
import path from 'path';
import { IpcMessages } from '../shared/ipcMessages';
import { ensureDirectoryExists, moveDirContents, deleteDir } from './fileUtils';
import { Store, StoreKeys } from './store';
import { isTesting } from './utils';
import { TestIpcMessages } from '../../../test/TestIpcMessages';
import { backups as str } from './strings';

function log(...message: any) {
  console.log('archiveManager:', ...message);
}

function logError(...message: any) {
  console.error('archiveManager:', ...message);
}

export const BackupsDirectoryName = 'Standard Notes Backups';

export interface ArchiveManager {
  backupsAreEnabled: boolean;
  toggleBackupsStatus(): void;
  backupsLocation: string;
  applicationDidBlur(): void;
  changeBackupsLocation(): void;
  beginBackups(): void;
  performBackup(): void;
}

export function createArchiveManager(
  webContents: WebContents,
  store: Store,
  ipcMain: IpcMain
): ArchiveManager {
  let backupsLocation = store.get(StoreKeys.BackupsLocation);
  let backupsDisabled = store.get(StoreKeys.BackupsDisabled);
  let needsBackup = false;

  async function setBackupsLocation(location: string) {
    const previousLocation = backupsLocation;
    const newLocation = path.join(location, BackupsDirectoryName);

    await moveDirContents(previousLocation, newLocation);
    await deleteDir(previousLocation);

    /** Wait for the operation to be successful before saving new location */
    backupsLocation = newLocation;
    store.set(StoreKeys.BackupsLocation, backupsLocation);
  }

  ipcMain.on(IpcMessages.DataArchive, async (_event, data) => {
    if (backupsDisabled) return;
    let success: boolean;
    let name: string | undefined;
    try {
      name = await writeDataToFile(data);
      log(`Data backup succesfully saved: ${name}`);
      success = true;
    } catch (err) {
      success = false;
      logError('An error ocurred saving backup file', err);
    }
    webContents.send(IpcMessages.FinishedSavingBackup, { success });
    return name;
  });

  function performBackup() {
    if (backupsDisabled) return;
    webContents.send(IpcMessages.DownloadBackup);
  }

  async function writeDataToFile(data: any): Promise<string> {
    await ensureDirectoryExists(backupsLocation);

    const name = new Date().toISOString().replace(/:/g, '-') + '.txt';
    const filePath = path.join(backupsLocation, name);
    await fs.promises.writeFile(filePath, data);
    return name;
  }

  let interval: NodeJS.Timeout | undefined;
  function beginBackups() {
    if (interval) {
      clearInterval(interval);
    }

    needsBackup = true;
    const hoursInterval = 12;
    const seconds = hoursInterval * 60 * 60;
    const milliseconds = seconds * 1000;
    interval = setInterval(performBackup, milliseconds);
  }

  function toggleBackupsStatus() {
    backupsDisabled = !backupsDisabled;
    store.set(StoreKeys.BackupsDisabled, backupsDisabled);
    /** Create a backup on reactivation. */
    if (!backupsDisabled) {
      performBackup();
    }
  }

  if (isTesting()) {
    ipcMain.handle(TestIpcMessages.BackupsAreEnabled, () => !backupsDisabled);
    ipcMain.handle(TestIpcMessages.ToggleBackupsEnabled, toggleBackupsStatus);
    ipcMain.handle(TestIpcMessages.BackupsLocation, () => backupsLocation);
    ipcMain.handle(TestIpcMessages.PerformBackup, performBackup);
    ipcMain.handle(TestIpcMessages.ChangeBackupsLocation, (_event, location) =>
      setBackupsLocation(location)
    );
  }

  return {
    get backupsAreEnabled() {
      return !backupsDisabled;
    },
    get backupsLocation() {
      return backupsLocation;
    },
    performBackup,
    beginBackups,
    toggleBackupsStatus,
    applicationDidBlur() {
      if (needsBackup) {
        needsBackup = false;
        performBackup();
      }
    },
    async changeBackupsLocation() {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'showHiddenFiles', 'createDirectory'],
      });
      const path = result.filePaths[0];
      try {
        await setBackupsLocation(path);
        performBackup();
      } catch (e) {
        logError(e);
        dialog.showMessageBox({
          message: str().errorChangingDirectory(e)
        });
      }
    },
  };
}
