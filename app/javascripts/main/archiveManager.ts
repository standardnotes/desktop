import { app, dialog, IpcMain, WebContents } from 'electron';
import fs from 'fs';
import path from 'path';
import { IpcMessages } from '../shared/ipcMessages';
import { ensureDirectoryExists } from './fileUtils';
import { Store, StoreKeys } from './store';

function log(...message: any) {
  console.log('archiveManager:', ...message);
}

function logError(...message: any) {
  console.error('archiveManager:', ...message);
}

const defaultLocation = path.join(
  app.getPath('home'),
  'Standard Notes Backups'
);

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
  let backupsLocation = store.get(StoreKeys.BackupsLocation) || defaultLocation;
  let backupsDisabled = store.get(StoreKeys.BackupsDisabled) ?? false;
  let needsBackup = false;

  ipcMain.on(IpcMessages.DataArchive, async (_event, data) => {
    if (backupsDisabled) return;
    let success: boolean;
    try {
      const name = await writeDataToFile(data);
      log(`Data backup succesfully saved: ${name}`);
      success = true;
    } catch (err) {
      success = false;
      logError('An error ocurred saving backup file', err);
    }
    webContents.send(IpcMessages.FinishedSavingBackup, { success });
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

  return {
    get backupsAreEnabled() {
      return !backupsDisabled;
    },
    get backupsLocation() {
      return backupsLocation;
    },
    performBackup,
    beginBackups,
    applicationDidBlur() {
      if (needsBackup) {
        needsBackup = false;
        performBackup();
      }
    },
    async changeBackupsLocation() {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'showHiddenFiles', 'createDirectory']
      });
      const path = result.filePaths[0];
      backupsLocation = path;
      store.set(StoreKeys.BackupsLocation, path);
      performBackup();
    },
    toggleBackupsStatus() {
      backupsDisabled = !backupsDisabled;
      store.set(StoreKeys.BackupsDisabled, backupsDisabled);
    }
  };
}
