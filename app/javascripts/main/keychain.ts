import { app, BrowserWindow, ipcMain } from 'electron';
import keytar from 'keytar';
import { isLinux } from './platforms';
import { AppName } from './strings';
import { isDev, isTesting } from './utils';
import { IpcMessages } from '../shared/ipcMessages';
import { grantKeyringAccessJsPath, grantKeyringAccessUrl } from './paths';
import { Store, StoreKeys } from './store';

const ServiceName = isTesting()
  ? AppName + ' (Testing)'
  : isDev()
  ? AppName + ' (Development)'
  : AppName;
const AccountName = 'Standard Notes Account';

export async function ensureKeychainAccess(
  store: Store
): Promise<BrowserWindow | undefined> {
  if (!isLinux()) {
    /** Assume keychain is accessible */
    return;
  }
  if (!store.get(StoreKeys.UseNativeKeychain)) {
    /** Not using native keychain, no need to check if it is accessible */
    return;
  }

  try {
    await setKeychainValue(await getKeychainValue());
  } catch (_) {
    /** Can't access keychain. Ask users to grant access */
    return askForKeychainAccess(store);
  }
}

function askForKeychainAccess(store: Store): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    frame: false,
    width: 550,
    height: 600,
    center: true,
    show: false,
    webPreferences: {
      preload: grantKeyringAccessJsPath,
    },
  });
  window.on('ready-to-show', window.show);
  window.loadURL(grantKeyringAccessUrl);

  const quitListener = () => {
    app.quit();
  };
  ipcMain.once(IpcMessages.Quit, quitListener);

  return new Promise((resolve) => {
    ipcMain.once(IpcMessages.UseLocalstorageForKeychain, () => {
      store.set(StoreKeys.UseNativeKeychain, false);
      ipcMain.removeListener(IpcMessages.Quit, quitListener);
      resolve(window);
    });
  });
}

export async function getKeychainValue(): Promise<unknown> {
  try {
    const value = await keytar.getPassword(ServiceName, AccountName);
    if (value) {
      return JSON.parse(value);
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export function setKeychainValue(value: unknown): Promise<void> {
  return keytar.setPassword(ServiceName, AccountName, JSON.stringify(value));
}

export function clearKeychainValue(): Promise<boolean> {
  return keytar.deletePassword(ServiceName, AccountName);
}
