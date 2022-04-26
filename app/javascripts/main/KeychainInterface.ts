import { BrowserWindow } from 'electron'
import { Store } from './store'

export interface KeychainInterface {
  ensureKeychainAccess(store: Store): Promise<BrowserWindow | undefined>
  getKeychainValue(): Promise<unknown>
  setKeychainValue(value: unknown): Promise<void>
  clearKeychainValue(): Promise<boolean>
}
