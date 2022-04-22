import { DesktopDeviceInterface } from '@web/Device/DesktopDeviceInterface'
import { WebOrDesktopDevice } from '@web/Device/WebOrDesktopDevice'
import { RawKeychainValue, Environment } from '@web/Device/DesktopSnjsExports'
import { IpcMessages } from '../shared/ipcMessages'
import { CrossProcessBridge } from './CrossProcessBridge'

const FallbackLocalStorageKey = 'keychain'

export class DesktopDevice extends WebOrDesktopDevice implements DesktopDeviceInterface {
  public environment: Environment.Desktop = Environment.Desktop

  constructor(
    private mainThread: CrossProcessBridge,
    private useNativeKeychain: boolean,
    public extensionsServerHost: string,
    appVersion: string,
  ) {
    super(appVersion)
  }

  async getKeychainValue() {
    if (this.useNativeKeychain) {
      const keychainValue = await this.mainThread.getKeychainValue()
      return keychainValue
    } else {
      const value = window.localStorage.getItem(FallbackLocalStorageKey)
      if (value) {
        return JSON.parse(value)
      }
    }
  }

  async setKeychainValue(value: RawKeychainValue) {
    if (this.useNativeKeychain) {
      await this.mainThread.setKeychainValue(value)
    } else {
      window.localStorage.setItem(FallbackLocalStorageKey, JSON.stringify(value))
    }
  }

  async clearRawKeychainValue() {
    if (this.useNativeKeychain) {
      await this.mainThread.clearKeychainValue()
    } else {
      window.localStorage.removeItem(FallbackLocalStorageKey)
    }
  }

  syncComponents(componentsData: unknown) {
    this.mainThread.sendIpcMessage(IpcMessages.SyncComponents, {
      componentsData,
    })
  }

  onMajorDataChange() {
    this.mainThread.sendIpcMessage(IpcMessages.MajorDataChange, {})
  }

  onSearch(text: string) {
    this.mainThread.sendIpcMessage(IpcMessages.SearchText, { text })
  }

  onInitialDataLoad() {
    this.mainThread.sendIpcMessage(IpcMessages.InitialDataLoaded, {})
  }

  onSignOut(restart = true) {
    this.mainThread.sendIpcMessage(IpcMessages.SigningOut, { restart })
  }

  async downloadBackup() {
    const receiver = window.desktopCommunicationReceiver

    receiver.didBeginBackup()

    try {
      const data = await receiver.requestBackupFile()
      if (data) {
        this.mainThread.sendIpcMessage(IpcMessages.DataArchive, data)
      } else {
        receiver.didFinishBackup(false)
      }
    } catch (error) {
      console.error(error)
      receiver.didFinishBackup(false)
    }
  }

  async localBackupsCount() {
    return this.mainThread.localBackupsCount()
  }

  viewlocalBackups() {
    this.mainThread.viewlocalBackups()
  }

  async deleteLocalBackups() {
    this.mainThread.deleteLocalBackups()
  }
}
