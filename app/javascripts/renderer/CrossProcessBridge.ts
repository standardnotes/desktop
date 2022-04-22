export interface CrossProcessBridge {
  get extServerHost(): Promise<string | null>

  get useNativeKeychain(): Promise<boolean>

  get rendererPath(): Promise<string>

  get isMacOS(): Promise<boolean>

  get appVersion(): Promise<string>

  get useSystemMenuBar(): Promise<boolean>

  sendIpcMessage(message: string, data: unknown): Promise<void>

  closeWindow(): Promise<void>

  minimizeWindow(): Promise<void>

  maximizeWindow(): Promise<void>

  unmaximizeWindow(): Promise<void>

  isWindowMaximized(): Promise<boolean>

  getKeychainValue(): Promise<unknown>

  setKeychainValue: (value: unknown) => Promise<void>

  clearKeychainValue(): Promise<void>

  localBackupsCount(): Promise<number>

  viewlocalBackups(): Promise<void>

  deleteLocalBackups(): Promise<void>
}
