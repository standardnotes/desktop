export interface TestIPCMessage {
  id: number;
  type: MessageType;
  args: any[];
}

export interface TestIPCMessageResult {
  id: number;
  resolve?: any;
  reject?: any;
}

export enum MessageType {
  Ready,
  WindowCount,
  StoreData,
  StoreSettingsLocation,
  StoreSet,
  AppMenuItems,
  SpellCheckerManager,
  SpellCheckerLanguages,
  ClickLanguage,
  BackupsAreEnabled,
  ToggleBackupsEnabled,
  BackupsLocation,
  PerformBackup,
  ChangeBackupsLocation,
  MenuReloaded,
  UpdateSettingsPath,
  UpdateSettings,
  CheckForUpdate,
  UpdateManagerTriggeredMenuReload,
  Relaunch,
  DataArchive,
  WindowLoaded,
  GetJSON,
  DownloadFile,
}
