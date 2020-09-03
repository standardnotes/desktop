/* eslint-disable no-undef */
import { IpcMessages } from '../shared/ipcMessages';
const messageBus = new ElectronValence.FrameMessageBus();
const receiver = new ElectronValence.Receiver(messageBus);

/** Accessed by web app */
window._extensions_manager_location =
  'extensions/extensions-manager/dist/index.html';
window._batch_manager_location = 'extensions/batch-manager/dist/index.html';
window.isElectron = true;

function migrateKeychain(bridge) {
  const key = 'keychain';
  const value = window.localStorage.getItem(key);
  if (value) {
    /** Migrate to native keychain */
    console.warn('Migrating keychain from localStorage to native keychain.');
    window.localStorage.removeItem(key);
    return bridge.setKeychainValue(JSON.parse(value));
  }
}

(async () => {
  await receiver.ready;
  const bridge = receiver.items[0];
  window.bridge = bridge;

  await migrateKeychain(bridge);

  window.startApplication(
    // eslint-disable-next-line no-undef
    DEFAULT_SYNC_SERVER || 'https://sync.standardnotes.org',
    {
      environment: 2 /** Desktop */,

      getKeychainValue: () => bridge.getKeychainValue(),
      setKeychainValue: (value) => bridge.setKeychainValue(value),
      clearKeychainValue: () => bridge.clearKeychainValue(),

      extensionsServerHost: await bridge.extServerHost,
      syncComponents(componentsData) {
        bridge.sendIpcMessage(IpcMessages.SyncComponents, { componentsData });
      },
      onMajorDataChange() {
        bridge.sendIpcMessage(IpcMessages.MajorDataChange, {});
      },
      onSearch(text) {
        bridge.sendIpcMessage(IpcMessages.SearchText, { text });
      },
      onInitialDataLoad() {
        bridge.sendIpcMessage(IpcMessages.InitialDataLoaded, {});
      },
    }
  );
  angular.bootstrap(document, ['app']);

  configureWindow(bridge);

  await new Promise((resolve) => angular.element(document).ready(resolve));
  registerIpcMessageListener(bridge);
  configureDesktopManager(window.desktopManager);
})();
loadZipLibrary();

async function configureWindow(bridge) {
  const [isMacOS, useSystemMenuBar, appVersion] = await Promise.all([
    bridge.isMacOS,
    bridge.useSystemMenuBar,
    bridge.appVersion,
  ]);

  window.electronAppVersion = appVersion;

  /*
  Title bar events
  */
  document.getElementById('menu-btn').addEventListener('click', (e) => {
    bridge.sendIpcMessage(IpcMessages.DisplayAppMenu, { x: e.x, y: e.y });
  });

  document.getElementById('min-btn').addEventListener('click', () => {
    bridge.minimizeWindow();
  });

  document.getElementById('max-btn').addEventListener('click', async () => {
    if (await bridge.isWindowMaximized()) {
      bridge.unmaximizeWindow();
    } else {
      bridge.maximizeWindow();
    }
  });

  document.getElementById('close-btn').addEventListener('click', () => {
    bridge.closeWindow();
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

async function configureDesktopManager(desktopManager) {
  desktopManager.onExtensionsReady();
}

function registerIpcMessageListener(bridge) {
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
      desktopManager.desktop_didBeginBackup();
      try {
        const data = await desktopManager.desktop_requestBackupFile();
        if (data) {
          bridge.sendIpcMessage(IpcMessages.DataArchive, data);
        }
      } catch (error) {
        console.error(error);
        desktopManager.desktop_didFinishBackup(false);
      }
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
