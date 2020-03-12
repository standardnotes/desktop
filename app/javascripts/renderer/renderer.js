import { IpcMessages } from '../shared/ipcMessages';
const messageBus = new ElectronValence.FrameMessageBus();
const receiver = new ElectronValence.Receiver(messageBus);

/** Accessed by web app */
window._default_sf_server = 'https://sync.standardnotes.org';
window._extensions_manager_location =
  'extensions/extensions-manager/dist/index.html';
window._batch_manager_location = 'extensions/batch-manager/dist/index.html';
window.isElectron = true;

(async () => {
  await receiver.ready;
  const bridge = receiver.items[0];
  configureWindow(bridge);

  await new Promise(resolve => angular.element(document).ready(resolve));
  const desktopManager = angular
    .element(document)
    .injector()
    .get('desktopManager');
  registerIpcMessageListener(desktopManager, bridge);
  configureDesktopManager(desktopManager, bridge);
})();
loadZipLibrary();

async function configureWindow(bridge) {
  const [isMacOS, useSystemMenuBar, appVersion] = await Promise.all([
    bridge.isMacOS,
    bridge.useSystemMenuBar,
    bridge.appVersion
  ]);

  window.electronAppVersion = appVersion;

  // disable drag-n-drop of file in the app
  document.addEventListener('dragover', event => event.preventDefault());
  document.addEventListener('drop', event => event.preventDefault());

  /*
  Title bar events
  */
  document.getElementById('menu-btn').addEventListener('click', e => {
    bridge.sendIpcMessage(IpcMessages.DisplayAppMenu, { x: e.x, y: e.y });
  });

  document.getElementById('min-btn').addEventListener('click', e => {
    bridge.minimizeWindow();
  });

  document.getElementById('max-btn').addEventListener('click', async e => {
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

async function configureDesktopManager(desktopManager, bridge) {
  const extServerHost = await bridge.extServerHost;
  desktopManager.desktop_setExtServerHost(extServerHost);

  desktopManager.desktop_setComponentInstallationSyncHandler(
    async componentsData => {
      /* Handled by PackageManager */
      bridge.sendIpcMessage(IpcMessages.SyncComponents, { componentsData });
    }
  );

  desktopManager.desktop_setSearchHandler(text => {
    bridge.sendIpcMessage(IpcMessages.SearchText, { text });
  });

  desktopManager.desktop_setInitialDataLoadHandler(() => {
    /* Handled by ArchiveManager */
    bridge.sendIpcMessage(IpcMessages.InitialDataLoaded, {});
  });

  desktopManager.desktop_setIpcMessages.MajorDataChangeHandler(() => {
    bridge.sendIpcMessage(IpcMessages.MajorDataChange, {});
  });
}

function registerIpcMessageListener(desktopManager, bridge) {
  window.addEventListener('message', event => {
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
      var controllerElement = document.querySelector('#home');
      var controllerScope = angular.element(controllerElement).scope();
      controllerScope.onUpdateAvailable();
    } else if (message === IpcMessages.DownloadBackup) {
      desktopManager.desktop_didBeginBackup();
      desktopManager.desktop_requestBackupFile(data => {
        if (data) {
          bridge.sendIpcMessage('data-archive', data);
        }
      });
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
