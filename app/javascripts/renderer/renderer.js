import { IpcMessages } from '../shared/ipcMessages';
const messageBus = new ElectronValence.FrameMessageBus();
const receiver = new ElectronValence.Receiver(messageBus);

/** Accessed by web app */
window._extensions_manager_location =
  'extensions/extensions-manager/dist/index.html';
window._batch_manager_location = 'extensions/batch-manager/dist/index.html';

/** @returns whether the keychain structure is up to date or not */
async function migrateKeychain(mainThread) {
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
    return true;
  } else if (await mainThread.getKeychainValue()) {
    /** Keychain value is already present */
    return true;
  } else {
    /** Unknown or pre-migration configuration, abort */
    return false;
  }
}

async function createWebBridge(mainThread) {
  let keychainMethods;
  if (await migrateKeychain(mainThread)) {
    /** Keychain is migrated, we can rely on native methods */
    keychainMethods = {
      getKeychainValue: () => mainThread.getKeychainValue(),
      setKeychainValue: (value) => mainThread.setKeychainValue(value),
      clearKeychainValue: () => mainThread.clearKeychainValue(),
    };
  } else {
    /** Keychain is not migrated, use web-compatible keychain methods */
    const key = 'keychain';
    keychainMethods = {
      getKeychainValue() {
        const value = window.localStorage.getItem(key);
        if (value) {
          return JSON.parse(value);
        }
      },
      setKeychainValue(value) {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      clearKeychainValue() {
        window.localStorage.removeItem(key);
      },
    };
  }

  return {
    ...keychainMethods,
    environment: 2 /** Desktop */,
    extensionsServerHost: await mainThread.extServerHost,
    syncComponents(componentsData) {
      mainThread.sendIpcMessage(IpcMessages.SyncComponents, {
        componentsData,
      });
    },
    onMajorDataChange() {
      mainThread.sendIpcMessage(IpcMessages.MajorDataChange, {});
    },
    onSearch(text) {
      mainThread.sendIpcMessage(IpcMessages.SearchText, { text });
    },
    onInitialDataLoad() {
      mainThread.sendIpcMessage(IpcMessages.InitialDataLoaded, {});
    },
    async downloadBackup() {
      const desktopManager = window.desktopManager;
      desktopManager.desktop_didBeginBackup();
      try {
        const data = await desktopManager.desktop_requestBackupFile();
        if (data) {
          mainThread.sendIpcMessage(IpcMessages.DataArchive, data);
        }
      } catch (error) {
        console.error(error);
        desktopManager.desktop_didFinishBackup(false);
      }
    },
  };
}

(async () => {
  await receiver.ready;
  const mainThread = receiver.items[0];

  const webBridge = await createWebBridge(mainThread);
  window.startApplication(
    // eslint-disable-next-line no-undef
    DEFAULT_SYNC_SERVER || 'https://sync.standardnotes.org',
    webBridge
  );
  angular.bootstrap(document, ['app']);

  configureWindow(mainThread);

  await new Promise((resolve) => angular.element(document).ready(resolve));
  registerIpcMessageListener(webBridge);
})();
loadZipLibrary();

async function configureWindow(mainThread) {
  const [isMacOS, useSystemMenuBar, appVersion] = await Promise.all([
    mainThread.isMacOS,
    mainThread.useSystemMenuBar,
    mainThread.appVersion,
  ]);

  window.electronAppVersion = appVersion;

  /*
  Title bar events
  */
  document.getElementById('menu-btn').addEventListener('click', (e) => {
    mainThread.sendIpcMessage(IpcMessages.DisplayAppMenu, {
      x: e.x,
      y: e.y,
    });
  });

  document.getElementById('min-btn').addEventListener('click', () => {
    mainThread.minimizeWindow();
  });

  document.getElementById('max-btn').addEventListener('click', async () => {
    if (await mainThread.isWindowMaximized()) {
      mainThread.unmaximizeWindow();
    } else {
      mainThread.maximizeWindow();
    }
  });

  document.getElementById('close-btn').addEventListener('click', () => {
    mainThread.closeWindow();
  });

  // For Mac inset window
  const sheet = window.document.styleSheets[0];
  if (isMacOS) {
    sheet.insertRule(
      '#tags-column { padding-top: 25px !important; }',
      sheet.cssRules.length
    );
  }

  if (isMacOS || useSystemMenuBar) {
    // !important is important here because #desktop-title-bar has display: flex.
    sheet.insertRule(
      '#desktop-title-bar { display: none !important; }',
      sheet.cssRules.length
    );
  } else {
    /* Use custom title bar. Take the sn-titlebar-height off of
    the app content height so its not overflowing */
    sheet.insertRule(
      `.main-ui-view { height: calc(100vh - var(--sn-desktop-titlebar-height)) !important;
        min-height: calc(100vh - var(--sn-desktop-titlebar-height)) !important; }`,
      sheet.cssRules.length
    );
  }
}

function registerIpcMessageListener(webBridge) {
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
      desktopManager.desktop_onComponentInstallationComplete(
        data.component,
        data.error
      );
    } else if (message === IpcMessages.UpdateAvailable) {
      const controllerElement = document.querySelector(
        'application-group-view'
      );
      const controllerScope = angular.element(controllerElement).scope();
      controllerScope.onUpdateAvailable();
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
    zip.workerScriptsPath = './vendor/zip/';
  };
}
