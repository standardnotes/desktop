import { IpcMessages } from '../shared/ipcMessages';
import { Store, StoreKeys } from '../main/store';
import SecureSpellChecker from '@standardnotes/electron-secure-spellchecker';
const {
  Transmitter,
  FrameMessageBus,
  Validation,
} = require('sn-electron-valence/Transmitter');
const { ipcRenderer } = require('electron');
const path = require('path');
const rendererPath = path.join('file://', __dirname, '/renderer.js');

const remote = require('@electron/remote');
const app = require('@electron/remote').app;

const { PropertyType } = Validation;
const messageBus = new FrameMessageBus();
const transmitter = new Transmitter(messageBus, {
  isMacOS: PropertyType.VALUE,
  appVersion: PropertyType.VALUE,
  extServerHost: PropertyType.VALUE,
  useNativeKeychain: PropertyType.VALUE,
  useSystemMenuBar: PropertyType.VALUE,
  sendIpcMessage: {
    type: PropertyType.METHOD,
    argValidators: [{ type: 'string', minLength: 1 }, { type: 'object' }],
  },
  closeWindow: { type: PropertyType.METHOD },
  minimizeWindow: { type: PropertyType.METHOD },
  maximizeWindow: { type: PropertyType.METHOD },
  unmaximizeWindow: { type: PropertyType.METHOD },
  isWindowMaximized: { type: PropertyType.METHOD },
  getKeychainValue: { type: PropertyType.METHOD },
  setKeychainValue: {
    type: PropertyType.METHOD,
    argValidators: [{ type: 'object' }],
  },
  clearKeychainValue: { type: PropertyType.METHOD },
  localBackupsCount: { type: PropertyType.METHOD },
  viewlocalBackups: { type: PropertyType.METHOD },
  deleteLocalBackups: { type: PropertyType.METHOD },
});

process.once('loaded', function () {
  loadTransmitter();
  listenForIpcEvents();
  SecureSpellChecker.setSpellCheckProvider();
});

function loadTransmitter() {
  transmitter.expose({
    extServerHost: Store.get(StoreKeys.ExtServerHost),
    useNativeKeychain: Store.get(StoreKeys.UseNativeKeychain) ?? true,
    rendererPath,
    isMacOS: process.platform === 'darwin',
    appVersion: app.getVersion(),
    useSystemMenuBar: Store.get(StoreKeys.UseSystemMenuBar),

    /**
     * All functions must be async, as electron-valence expects to run .then()
     * on them.
     */
    sendIpcMessage: async (message, data) => {
      ipcRenderer.send(message, data);
    },
    closeWindow: async () => {
      remote.getCurrentWindow().close();
    },
    minimizeWindow: async () => {
      remote.getCurrentWindow().minimize();
    },
    maximizeWindow: async () => {
      remote.getCurrentWindow().maximize();
    },
    unmaximizeWindow: async () => {
      remote.getCurrentWindow().unmaximize();
    },
    isWindowMaximized: async () => {
      return remote.getCurrentWindow().isMaximized();
    },
    getKeychainValue: () => ipcRenderer.invoke(IpcMessages.GetKeychainValue),
    setKeychainValue: (value) =>
      ipcRenderer.invoke(IpcMessages.SetKeychainValue, value),
    clearKeychainValue: () =>
      ipcRenderer.invoke(IpcMessages.ClearKeychainValue),
    localBackupsCount: () => ipcRenderer.invoke(IpcMessages.LocalBackupsCount),
    viewlocalBackups: async () => {
      ipcRenderer.send(IpcMessages.ViewLocalBackups);
    },
    deleteLocalBackups: async () =>
      ipcRenderer.invoke(IpcMessages.DeleteLocalBackups),
  });
}

function listenForIpcEvents() {
  const sendMessage = (message, payload = {}) => {
    // eslint-disable-next-line no-undef
    window.postMessage(
      JSON.stringify({ message, data: payload }),
      rendererPath
    );
  };

  ipcRenderer.on(IpcMessages.UpdateAvailable, function (_event, data) {
    sendMessage(IpcMessages.UpdateAvailable, data);
  });

  ipcRenderer.on(IpcMessages.DownloadBackup, function (_event, data) {
    sendMessage(IpcMessages.DownloadBackup, data);
  });

  ipcRenderer.on(IpcMessages.FinishedSavingBackup, function (_event, data) {
    sendMessage(IpcMessages.FinishedSavingBackup, data);
  });

  ipcRenderer.on(IpcMessages.WindowBlurred, function (_event, data) {
    sendMessage(IpcMessages.WindowBlurred, data);
  });

  ipcRenderer.on(IpcMessages.WindowFocused, function (_event, data) {
    sendMessage(IpcMessages.WindowFocused, data);
  });

  ipcRenderer.on(IpcMessages.InstallComponentComplete, function (_event, data) {
    sendMessage(IpcMessages.InstallComponentComplete, data);
  });
}
