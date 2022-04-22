import { app, BrowserWindow, ipcMain } from 'electron'
import keytar from 'keytar'
import { isLinux } from './platforms'
import { AppName } from './strings'
import { keychainAccessIsUserConfigurable } from './constants'
import { isDev, isTesting } from './utils'
import { IpcMessages } from '../shared/ipcMessages'
import { Urls, Paths } from './paths'
import { Store, StoreKeys } from './store'

const ServiceName = isTesting() ? AppName + ' (Testing)' : isDev() ? AppName + ' (Development)' : AppName
const AccountName = 'Standard Notes Account'

export async function ensureKeychainAccess(store: Store): Promise<BrowserWindow | undefined> {
  if (!isLinux()) {
    /** Assume keychain is accessible */
    return
  }
  const useNativeKeychain = store.get(StoreKeys.UseNativeKeychain)
  if (useNativeKeychain === null) {
    /**
     * App has never attempted to access keychain before. Do it and set the
     * store value according to what happens
     */
    try {
      await getKeychainValue()
      store.set(StoreKeys.UseNativeKeychain, true)
    } catch (_) {
      /** Can't access keychain. */
      if (keychainAccessIsUserConfigurable) {
        return askForKeychainAccess(store)
      } else {
        /** User can't configure keychain access, fall back to local storage */
        store.set(StoreKeys.UseNativeKeychain, false)
      }
    }
  }
}

function askForKeychainAccess(store: Store): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 540,
    height: 400,
    center: true,
    show: false,
    webPreferences: {
      preload: Paths.grantLinuxPasswordsAccessJs,
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  })
  window.on('ready-to-show', window.show)
  window.loadURL(Urls.grantLinuxPasswordsAccessHtml)

  const quit = () => {
    app.quit()
  }
  ipcMain.once(IpcMessages.Quit, quit)
  window.once('close', quit)

  ipcMain.on(IpcMessages.LearnMoreAboutKeychainAccess, () => {
    window.setSize(window.getSize()[0], 600, true)
  })

  return new Promise((resolve) => {
    ipcMain.once(IpcMessages.UseLocalstorageForKeychain, () => {
      store.set(StoreKeys.UseNativeKeychain, false)
      ipcMain.removeListener(IpcMessages.Quit, quit)
      window.removeListener('close', quit)
      resolve(window)
    })
  })
}

export async function getKeychainValue(): Promise<unknown> {
  try {
    const value = await keytar.getPassword(ServiceName, AccountName)
    if (value) {
      return JSON.parse(value)
    }
  } catch (error) {
    console.error(error)
    throw error
  }
}

export function setKeychainValue(value: unknown): Promise<void> {
  return keytar.setPassword(ServiceName, AccountName, JSON.stringify(value))
}

export function clearKeychainValue(): Promise<boolean> {
  return keytar.deletePassword(ServiceName, AccountName)
}
