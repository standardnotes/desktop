import { IpcMessages } from '../shared/ipcMessages';
import { StartApplication } from '@web/startApplication';
import { Bridge, ElectronDesktopCallbacks } from '@web/services/bridge';

declare const BUGSNAG_API_KEY: string;
declare const DEFAULT_SYNC_SERVER: string;
declare const DEFAULT_FILES_SERVER: string;
declare const WEBSOCKET_URL: string;
declare const ENABLE_UNFINISHED_FEATURES: string;
declare const PURCHASE_URL: string;
declare const PLANS_URL: string;
declare const DASHBOARD_URL: string;

declare global {
  interface Window {
    bridge: Bridge;
    bugsnagApiKey: string;
    dashboardUrl: string;
    desktopManager: ElectronDesktopCallbacks;
    electronAppVersion: string;
    ElectronValence: any;
    enableUnfinishedFeatures: boolean;
    plansUrl: string;
    purchaseUrl: string;
    startApplication: StartApplication;
    zip: any;
  }
}

const messageBus = new window.ElectronValence.FrameMessageBus();
const receiver = new window.ElectronValence.Receiver(messageBus);

/** Accessed by web app */
window.bugsnagApiKey = BUGSNAG_API_KEY;
window.dashboardUrl = DASHBOARD_URL;
window.enableUnfinishedFeatures = ENABLE_UNFINISHED_FEATURES === 'true';
window.plansUrl = PLANS_URL;
window.purchaseUrl = PURCHASE_URL;

(async () => {
  await receiver.ready;
  const mainThread = receiver.items[0];

  await configureWindow(mainThread);

  window.bridge = await createWebBridge(mainThread);
  window.startApplication(
    DEFAULT_SYNC_SERVER,
    DEFAULT_FILES_SERVER,
    window.bridge,
    window.enableUnfinishedFeatures,
    WEBSOCKET_URL
  );

  registerIpcMessageListener(window.bridge);
})();

loadZipLibrary();

/** @returns whether the keychain structure is up to date or not */
async function migrateKeychain(mainThread: any): Promise<boolean> {
  if (!(await mainThread.useNativeKeychain)) {
    /** User chose not to use keychain, do not migrate. */
    return false;
  }

  const key = 'keychain';
  const localStorageValue = window.localStorage.getItem(key);
  if (localStorageValue) {
    /** Migrate to native keychain */
    console.warn('Migrating keychain from localStorage to native keychain.');
    window.localStorage.removeItem(key);
    await mainThread.setKeychainValue(JSON.parse(localStorageValue));
  }
  return true;
}

async function createWebBridge(mainThread: any): Promise<Bridge> {
  let keychainMethods;
  if (await migrateKeychain(mainThread)) {
    /** Keychain is migrated, we can rely on native methods */
    keychainMethods = {
      async getKeychainValue() {
        const keychainValue = await mainThread.getKeychainValue();
        return keychainValue;
      },
      setKeychainValue(value: unknown) {
        return mainThread.setKeychainValue(value);
      },
      clearKeychainValue() {
        return mainThread.clearKeychainValue();
      },
    };
  } else {
    /** Keychain is not migrated, use web-compatible keychain methods */
    const key = 'keychain';
    keychainMethods = {
      async getKeychainValue() {
        const value = window.localStorage.getItem(key);
        if (value) {
          return JSON.parse(value);
        }
      },
      async setKeychainValue(value: unknown) {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      async clearKeychainValue() {
        window.localStorage.removeItem(key);
      },
    };
  }

  return {
    ...keychainMethods,
    appVersion: await mainThread.appVersion,
    /**
     * Importing the Environment enum from SNJS results in a much larger bundle
     * size, so we use the number literal corresponding to Environment.Desktop
     */
    environment: 2,
    extensionsServerHost: await mainThread.extServerHost,
    syncComponents(componentsData: unknown) {
      mainThread.sendIpcMessage(IpcMessages.SyncComponents, {
        componentsData,
      });
    },
    onMajorDataChange() {
      mainThread.sendIpcMessage(IpcMessages.MajorDataChange, {});
    },
    onSearch(text: string) {
      mainThread.sendIpcMessage(IpcMessages.SearchText, { text });
    },
    onInitialDataLoad() {
      mainThread.sendIpcMessage(IpcMessages.InitialDataLoaded, {});
    },
    onSignOut(restart = true) {
      mainThread.sendIpcMessage(IpcMessages.SigningOut, { restart });
    },
    async downloadBackup() {
      const desktopManager = window.desktopManager;
      desktopManager.desktop_didBeginBackup();
      try {
        const data = await desktopManager.desktop_requestBackupFile();
        if (data) {
          mainThread.sendIpcMessage(IpcMessages.DataArchive, data);
        } else {
          desktopManager.desktop_didFinishBackup(false);
        }
      } catch (error) {
        console.error(error);
        desktopManager.desktop_didFinishBackup(false);
      }
    },
    async localBackupsCount() {
      return mainThread.localBackupsCount();
    },
    viewlocalBackups() {
      mainThread.viewlocalBackups();
    },
    async deleteLocalBackups() {
      mainThread.deleteLocalBackups();
    },
  };
}

async function configureWindow(mainThread: any) {
  const [isMacOS, useSystemMenuBar, appVersion] = await Promise.all([
    mainThread.isMacOS,
    mainThread.useSystemMenuBar,
    mainThread.appVersion,
  ]);

  window.electronAppVersion = appVersion;

  /*
  Title bar events
  */
  document.getElementById('menu-btn')!.addEventListener('click', (e) => {
    mainThread.sendIpcMessage(IpcMessages.DisplayAppMenu, {
      x: e.x,
      y: e.y,
    });
  });

  document.getElementById('min-btn')!.addEventListener('click', () => {
    mainThread.minimizeWindow();
  });

  document.getElementById('max-btn')!.addEventListener('click', async () => {
    if (await mainThread.isWindowMaximized()) {
      mainThread.unmaximizeWindow();
    } else {
      mainThread.maximizeWindow();
    }
  });

  document.getElementById('close-btn')!.addEventListener('click', () => {
    mainThread.closeWindow();
  });

  // For Mac inset window
  const sheet = window.document.styleSheets[0];
  if (isMacOS) {
    sheet.insertRule('#navigation { padding-top: 25px !important; }', sheet.cssRules.length);
  }

  if (isMacOS || useSystemMenuBar) {
    // !important is important here because #desktop-title-bar has display: flex.
    sheet.insertRule('#desktop-title-bar { display: none !important; }', sheet.cssRules.length);
  } else {
    /* Use custom title bar. Take the sn-titlebar-height off of
    the app content height so its not overflowing */
    sheet.insertRule(
      'body { padding-top: var(--sn-desktop-titlebar-height); }',
      sheet.cssRules.length
    );
    sheet.insertRule(
      `.main-ui-view { height: calc(100vh - var(--sn-desktop-titlebar-height)) !important;
        min-height: calc(100vh - var(--sn-desktop-titlebar-height)) !important; }`,
      sheet.cssRules.length
    );
  }
}

function registerIpcMessageListener(webBridge: any) {
  window.addEventListener('message', async (event) => {
    // We don't have access to the full file path.
    if (event.origin !== 'file://') {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (e) {
      // message doesn't belong to us
      return;
    }

    const desktopManager = window.desktopManager;
    const message = payload.message;
    const data = payload.data;

    if (message === IpcMessages.WindowBlurred) {
      desktopManager.desktop_windowLostFocus();
    } else if (message === IpcMessages.WindowFocused) {
      desktopManager.desktop_windowGainedFocus();
    } else if (message === IpcMessages.InstallComponentComplete) {
      // Responses from packageManager
      desktopManager.desktop_onComponentInstallationComplete(data.component, data.error);
    } else if (message === IpcMessages.UpdateAvailable) {
      desktopManager.desktop_updateAvailable();
    } else if (message === IpcMessages.DownloadBackup) {
      webBridge.downloadBackup();
    } else if (message === IpcMessages.FinishedSavingBackup) {
      desktopManager.desktop_didFinishBackup(data.success);
    }
  });
}

async function loadZipLibrary() {
  // load zip library (for exporting items as zip)
  const scriptTag = document.createElement('script');
  scriptTag.src = './vendor/zip/zip.js';
  scriptTag.async = true;
  const headTag = document.getElementsByTagName('head')[0];
  headTag.appendChild(scriptTag);
  scriptTag.onload = () => {
    window.zip.workerScriptsPath = './vendor/zip/';
  };
}
