const messageBus = new ElectronValence.FrameMessageBus();
const receiver = new ElectronValence.Receiver(messageBus);

/** Accessed by web app */
window._default_sf_server = "https://sync.standardnotes.org";
window._extensions_manager_location = "extensions/extensions-manager/dist/index.html";
window._batch_manager_location = "extensions/batch-manager/dist/index.html";
window.isElectron = true;

const angularReady = new Promise((resolve, reject) => {
  angular.element(document).ready(function () {
    resolve();
  });
});

let bridge;
let desktopManager;

Promise.all([
  angularReady,
  receiver.ready,
]).then(async () => {
  bridge = receiver.items[0];
  desktopManager = angular.element(document).injector().get('desktopManager');

  await registerIpcMessageListener();
  await configureDesktopManager();
  await configureWindow();
  await configureSpellcheck();
  await loadZipLibrary();
});

async function configureWindow() {
  const isMacOS = await bridge.isMacOS;
  const useSystemMenuBar = await bridge.useSystemMenuBar;

  window.electronAppVersion = await bridge.appVersion;

  // disable drag-n-drop of file in the app
  document.addEventListener('dragover', event => event.preventDefault());
  document.addEventListener('drop', event => event.preventDefault());

  /*
  Title bar events
  */
  document.getElementById("menu-btn").addEventListener("click", (e) => {
    bridge.sendIpcMessage(
      "display-app-menu", 
      { x: e.x, y: e.y }
    );
  });

  document.getElementById("min-btn").addEventListener("click", (e) => {
    bridge.minimizeWindow();
  });

  document.getElementById("max-btn").addEventListener("click", async (e) => {
    if(await bridge.isWindowMaximized()) {
      bridge.unmaximizeWindow();
    } else {
      bridge.maximizeWindow();
    }
  });

  document.getElementById("close-btn").addEventListener("click", (e) => {
    bridge.closeWindow();
  });

  // For Mac inset window
  const sheet = window.document.styleSheets[0];
  if(isMacOS) {
    sheet.insertRule(
      '#tags-column { padding-top: 25px !important; }', 
      sheet.cssRules.length
    );
  }

  if(isMacOS || useSystemMenuBar) {
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

async function configureDesktopManager() {
  const extServerHost = await bridge.extServerHost;
  desktopManager.desktop_setExtServerHost(extServerHost);

  desktopManager.desktop_setComponentInstallationSyncHandler(async (componentsData) => {
    /* Handled by PackageManager */
    bridge.sendIpcMessage("sync-components", {componentsData});
  });

  desktopManager.desktop_setInstallComponentHandler((componentData) => {
    bridge.sendIpcMessage("install-component", componentData);
  });

  desktopManager.desktop_setSearchHandler((text) => {
    bridge.sendIpcMessage("search-text", {text});
  });

  desktopManager.desktop_setInitialDataLoadHandler(() => {
    /* Handled by ArchiveManager */
    bridge.sendIpcMessage("initial-data-loaded", {});
  });

  desktopManager.desktop_setMajorDataChangeHandler(() => {
    bridge.sendIpcMessage("major-data-change", {});
  });
}

async function registerIpcMessageListener() {
  window.addEventListener('message', (event) => {
    // We don't have access to the full file path.
    if(event.origin !== "file://") {
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

    if(message === "window-blurred") {
      desktopManager.desktop_windowLostFocus();
    } else if(message === "window-focused") {
      desktopManager.desktop_windowGainedFocus();
    } else if(message === "install-component-complete") {
      // Responses from packageManager
      desktopManager.desktop_onComponentInstallationComplete(data.component, data.error);
    } else if(message === "update-available") {
      var controllerElement = document.querySelector('#home');
      var controllerScope = angular.element(controllerElement).scope();
      controllerScope.onUpdateAvailable();
    } else if(message === "download-backup") {
      desktopManager.desktop_didBeginBackup();
      desktopManager.desktop_requestBackupFile((data) => {
        if(data) {
          bridge.sendIpcMessage('data-archive', data);
        }
      });
    } else if(message === "finished-saving-backup") {
      desktopManager.desktop_didFinishBackup(data.success);
    }
  });
}

async function loadZipLibrary() {
  // load zip library (for exporting items as zip)
  var scriptTag = document.createElement('script');
  scriptTag.src = "./vendor/zip/zip.js";
  scriptTag.async = true;
  var headTag = document.getElementsByTagName('head')[0];
  headTag.appendChild(scriptTag);
  scriptTag.onload = function() {
    zip.workerScriptsPath = "./vendor/zip/";
  };
}

async function configureSpellcheck() {
  const spellcheck = await bridge.spellcheck;

  spellcheck.reload();

  window.addEventListener('contextmenu', function(e) {
    // Only show the context menu in text editors.
    if (!e.target.closest('textarea, input, [contenteditable="true"]')) {
      return;
    }
    const selectedText = window.getSelection().toString();
    // The 'contextmenu' event is emitted after 'selectionchange' has fired but possibly before the
    // visible selection has changed. Try to wait to show the menu until after that, otherwise the
    // visible selection will update after the menu dismisses and look weird.
    setTimeout(function() {
      spellcheck.showContextMenuForText(selectedText);
    }, 30);
  });
}
