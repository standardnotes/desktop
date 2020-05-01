import { ChildProcess, spawn } from 'child_process';
import electronPath, { MenuItem } from 'electron';
import path from 'path';
import { deleteDir, readJSONFile } from '../app/javascripts/main/fileUtils';
import { Language } from '../app/javascripts/main/spellcheckerManager';
import { StoreKeys } from '../app/javascripts/main/store';
import { UpdateSettings } from '../app/javascripts/main/updateManager';
import { CommandLineArgs } from '../app/javascripts/shared/CommandLineArgs';
import {
  MessageType,
  TestIPCMessage,
  TestIPCMessageResult,
  AppTestMessage,
  AppMessageType,
} from './TestIpcMessage';

interface TestUpdateSettings extends Omit<UpdateSettings, 'lastCheck'> {
  lastCheck: string;
}

function spawnAppprocess(userDataPath: string) {
  return spawn(
    electronPath as any,
    [
      path.join(__dirname, '..'),
      CommandLineArgs.Testing,
      CommandLineArgs.UserDataPath,
      userDataPath,
    ],
    {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    }
  );
}

class Driver {
  private appProcess: ChildProcess;

  readonly userDataPath = path.join(
    __dirname,
    'data',
    'tmp',
    `userData-${Date.now()}-${Math.round(Math.random() * 10000)}`
  );

  private calls: Array<{
    resolve: (...args: any) => void;
    reject: (...args: any) => void;
  } | null> = [];

  private awaitedOnMessages: Array<{
    type: AppMessageType;
    resolve: (...args: any) => void;
  }> = [];

  appReady: Promise<unknown>;
  windowLoaded: Promise<unknown>;

  private receive = (message: TestIPCMessageResult | AppTestMessage) => {
    if ('type' in message) {
      this.awaitedOnMessages = this.awaitedOnMessages.filter(
        ({ type, resolve }) => {
          if (type === message.type) {
            resolve();
            return false;
          }
          return true;
        }
      );
    }
    if ('id' in message) {
      const call = this.calls[message.id]!;
      this.calls[message.id] = null;
      if (message.reject) {
        call.reject(message.reject);
      } else {
        call.resolve(message.resolve);
      }
    }
  };

  private waitOn = (messageType: AppMessageType) => {
    return new Promise((resolve) => {
      this.awaitedOnMessages.push({
        type: messageType,
        resolve,
      });
    });
  };

  constructor() {
    this.appProcess = spawnAppprocess(this.userDataPath);
    this.appProcess.on('message', this.receive);
    this.appReady = this.waitOn(AppMessageType.Ready);
    this.windowLoaded = this.waitOn(AppMessageType.WindowLoaded);
  }

  private send = (type: MessageType, ...args: any): Promise<any> => {
    const id = this.calls.length;
    const message: TestIPCMessage = {
      id,
      type,
      args,
    };
    this.appProcess.send(message);
    return new Promise((resolve, reject) => {
      this.calls.push({ resolve, reject });
    });
  };

  windowCount = (): Promise<number> => this.send(MessageType.WindowCount);

  readonly store = {
    dataOnDisk: async (): Promise<{ [key in StoreKeys]: any }> => {
      const location = await this.send(MessageType.StoreSettingsLocation);
      return readJSONFile(location);
    },
    dataLocation: (): Promise<string> =>
      this.send(MessageType.StoreSettingsLocation),
    setZoomFactor: (factor: number) =>
      this.send(MessageType.StoreSet, 'zoomFactor', factor),
  };

  readonly appMenu = {
    items: (): Promise<MenuItem[]> => this.send(MessageType.AppMenuItems),
    clickLanguage: (language: Language) =>
      this.send(MessageType.ClickLanguage, language),
  };

  readonly spellchecker = {
    manager: () => this.send(MessageType.SpellCheckerManager),
    languages: () => this.send(MessageType.SpellCheckerLanguages),
  };

  readonly backups = {
    enabled: (): Promise<boolean> => this.send(MessageType.BackupsAreEnabled),
    toggleEnabled: (): Promise<boolean> =>
      this.send(MessageType.ToggleBackupsEnabled),
    location: (): Promise<string> => this.send(MessageType.BackupsLocation),
    changeLocation: (location: string) =>
      this.send(MessageType.ChangeBackupsLocation, location),
    save: (data: any) => this.send(MessageType.DataArchive, data),
    perform: async () => {
      await this.windowLoaded;
      await this.send(MessageType.PerformBackup);
      await this.waitOn(AppMessageType.SavedBackup);
    },
  };

  readonly updates = {
    settings: (): Promise<TestUpdateSettings> =>
      this.send(MessageType.UpdateSettings),
    settingsLocation: (): Promise<string> =>
      this.send(MessageType.UpdateSettingsPath),
    check: () => this.send(MessageType.CheckForUpdate),
    menuReloadTriggered: (): Promise<boolean> =>
      this.send(MessageType.UpdateManagerTriggeredMenuReload),
  };

  readonly net = {
    getJSON: (url: string) => this.send(MessageType.GetJSON, url),
    downloadFile: (url: string, filePath: string) =>
      this.send(MessageType.DownloadFile, url, filePath),
  };

  stop = async () => {
    this.appProcess.kill();

    /** Give the process a little time before cleaning up */
    await new Promise((resolve) => setTimeout(resolve, 150));

    /**
     * Windows can throw EPERM or EBUSY errors when we try to delete the
     * user data directory too quickly.
     */
    const maxTries = 5;
    for (let i = 0; i < maxTries; i++) {
      try {
        await deleteDir(this.userDataPath);
        return;
      } catch (error) {
        if (error.code === 'EPERM' || error.code === 'EBUSY') {
          await new Promise((resolve) => setTimeout(resolve, 300));
        } else {
          throw error;
        }
      }
    }
    throw new Error(
      `Couldn't delete user data directory after ${maxTries} tries`
    );
  };

  restart = async () => {
    this.appProcess.kill();
    this.appProcess = spawnAppprocess(this.userDataPath);
    this.appProcess.on('message', this.receive);
    this.appReady = this.waitOn(AppMessageType.Ready);
    this.windowLoaded = this.waitOn(AppMessageType.WindowLoaded);
    await this.appReady;
  };
}

export type { Driver };

export async function createDriver() {
  const driver = new Driver();
  await driver.appReady;
  return driver;
}
