import { Component } from '../Main/Packages/PackageManagerInterface'
import { DesktopDeviceInterface } from '@web/Device/DesktopDeviceInterface'
import { WebOrDesktopDevice } from '@web/Device/WebOrDesktopDevice'
import { RawKeychainValue, Environment } from '@web/Device/DesktopSnjsExports'
import { CrossProcessBridge } from './CrossProcessBridge'

const FallbackLocalStorageKey = 'keychain'

export class DesktopDevice extends WebOrDesktopDevice implements DesktopDeviceInterface {
  public environment: Environment.Desktop = Environment.Desktop

  constructor(
    private remoteBridge: CrossProcessBridge,
    private useNativeKeychain: boolean,
    public extensionsServerHost: string,
    appVersion: string,
  ) {
    super(appVersion)
  }

  async getKeychainValue() {
    if (this.useNativeKeychain) {
      const keychainValue = await this.remoteBridge.getKeychainValue()
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
      await this.remoteBridge.setKeychainValue(value)
    } else {
      window.localStorage.setItem(FallbackLocalStorageKey, JSON.stringify(value))
    }
  }

  async clearRawKeychainValue() {
    if (this.useNativeKeychain) {
      await this.remoteBridge.clearKeychainValue()
    } else {
      window.localStorage.removeItem(FallbackLocalStorageKey)
    }
  }

  syncComponents(components: Component[]) {
    this.remoteBridge.syncComponents(components)
  }

  onMajorDataChange() {
    this.remoteBridge.onMajorDataChange()
  }

  onSearch(text: string) {
    this.remoteBridge.onSearch(text)
  }

  onInitialDataLoad() {
    this.remoteBridge.onInitialDataLoad()
  }

  destroyAllData(): void {
    this.remoteBridge.destroyAllData()
  }

  async downloadBackup() {
    const receiver = window.webClient

    receiver.didBeginBackup()

    try {
      const data = await receiver.requestBackupFile()
      if (data) {
        this.remoteBridge.saveDataBackup(data)
      } else {
        receiver.didFinishBackup(false)
      }
    } catch (error) {
      console.error(error)
      receiver.didFinishBackup(false)
    }
  }

  async localBackupsCount() {
    return this.remoteBridge.localBackupsCount()
  }

  viewlocalBackups() {
    this.remoteBridge.viewlocalBackups()
  }

  async deleteLocalBackups() {
    this.remoteBridge.deleteLocalBackups()
  }
}
