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
} from './TestIpcMessage';

function spawnAppprocess(
  userDataPath: string,
  receive: (message: TestIPCMessage) => void
) {
  const appProcess = spawn(
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

  let onWindowLoaded: () => void;
  const windowLoaded = new Promise<void>((resolve) => {
    onWindowLoaded = resolve;
  });

  let onAppReady: () => void;
  const appReady = new Promise<void>((resolve) => {
    onAppReady = resolve;
  });

  appProcess.on('message', (message) => {
    switch (message.type) {
      case MessageType.Ready:
        onAppReady();
        break;
      case MessageType.WindowLoaded:
        /** Give the app another half-second to set everything up */
        setTimeout(() => {
          onWindowLoaded();
        }, 500);
        break;
      default:
        receive(message);
    }
  });

  return { appProcess, appReady, windowLoaded };
}

interface TestUpdateSettings extends Omit<UpdateSettings, 'lastCheck'> {
  lastCheck: string;
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

  appReady: Promise<void>;
  windowLoaded: Promise<void>;

  constructor() {
    const { appProcess, appReady, windowLoaded } = spawnAppprocess(
      this.userDataPath,
      this.receive
    );
    this.appProcess = appProcess;
    this.appReady = appReady;
    this.windowLoaded = windowLoaded;
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

  private receive = (message: TestIPCMessageResult) => {
    const call = this.calls[message.id]!;
    this.calls[message.id] = null;
    if (message.reject) {
      call.reject(message.reject);
    } else {
      call.resolve(message.resolve);
    }
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
      /** Give the app another second to finish the backup. */
      return new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
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
    const { appProcess, appReady, windowLoaded } = spawnAppprocess(
      this.userDataPath,
      this.receive
    );
    this.appProcess = appProcess;
    this.appReady = appReady;
    this.windowLoaded = windowLoaded;
    await this.appReady;
  };
}

export type { Driver };

export async function createDriver() {
  const driver = new Driver();
  await driver.appReady;
  return driver;
}
