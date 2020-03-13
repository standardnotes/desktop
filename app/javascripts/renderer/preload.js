import {
  Store,
  StoreKeys
} from '../main/store';
const {
  Transmitter,
  FrameMessageBus,
  Validation
} = require('sn-electron-valence/Transmitter');
const { ipcRenderer, remote } = require('electron');
const path = require('path');
const rendererPath = path.join('file://', __dirname, '/renderer.js');

const { PropertyType } = Validation;
const messageBus = new FrameMessageBus();
const transmitter = new Transmitter(messageBus,
	{
		isMacOS: PropertyType.VALUE,
		appVersion: PropertyType.VALUE,
		extServerHost: PropertyType.VALUE,
		useSystemMenuBar: PropertyType.VALUE,
		sendIpcMessage: {
		  type: PropertyType.METHOD,
		  argValidators: [{ type: 'string', minLength: 1 }, { type: 'object'} ]
		},
		closeWindow: { type: PropertyType.METHOD },
		minimizeWindow: { type: PropertyType.METHOD },
		maximizeWindow: { type: PropertyType.METHOD },
		unmaximizeWindow: { type: PropertyType.METHOD },
		isWindowMaximized: { type: PropertyType.METHOD },
	},
);

process.once('loaded', function() {
  loadTransmitter();
  listenForIpcEvents();
});

function loadTransmitter() {
	transmitter.expose({
    extServerHost: Store.get(StoreKeys.ExtServerHost),
		rendererPath: rendererPath,
		isMacOS: process.platform === 'darwin',
		appVersion: remote.app.getVersion(),
		useSystemMenuBar: Store.get(StoreKeys.UseSystemMenuBar),

		// All functions must be async, as electron-valence expects to run .then() on them.
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
	});
}

function listenForIpcEvents() {
  const sendMessage = (message, payload = {}) => {
    window.postMessage(
      JSON.stringify({message, data: payload}),
      rendererPath
    );
  };

  ipcRenderer.on('update-available', function (event, data) {
    sendMessage('update-available', data);
  });

  ipcRenderer.on('download-backup', function (event, data) {
    sendMessage('download-backup', data);
  });

  ipcRenderer.on('finished-saving-backup', function (event, data) {
    sendMessage('finished-saving-backup', data);
  });

  ipcRenderer.on('window-blurred', function (event, data) {
    sendMessage('window-blurred', data);
  });

  ipcRenderer.on('window-focused', function (event, data) {
    sendMessage('window-focused', data);
  });

  ipcRenderer.on('install-component-complete', function (event, data) {
    sendMessage('install-component-complete', data);
  });
}
