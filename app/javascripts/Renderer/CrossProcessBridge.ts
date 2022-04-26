import { Component } from '../Main/Packages/PackageManagerInterface'

export interface CrossProcessBridge {
  get extServerHost(): string

  get useNativeKeychain(): boolean

  get rendererPath(): string

  get isMacOS(): boolean

  get appVersion(): string

  get useSystemMenuBar(): boolean

  closeWindow(): void

  minimizeWindow(): void

  maximizeWindow(): void

  unmaximizeWindow(): void

  isWindowMaximized(): boolean

  getKeychainValue(): Promise<unknown>

  setKeychainValue: (value: unknown) => Promise<void>

  clearKeychainValue(): Promise<boolean>

  localBackupsCount(): Promise<number>

  viewlocalBackups(): void

  deleteLocalBackups(): Promise<void>

  saveDataBackup(data: unknown): void

  displayAppMenu(): void

  syncComponents(components: Component[]): void
  onMajorDataChange(): void
  onSearch(text: string): void
  onInitialDataLoad(): void
  onSignOut(restart: boolean): void
}
