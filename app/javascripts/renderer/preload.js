const { webFrame, ipcRenderer, remote } = require('electron')
const osLocale = require('os-locale');
const os = require('os');

const Store = require('../main/store.js');
const buildEditorContextMenu = remote.require('electron-editor-context-menu');
const rendererPath = 'file://' + __dirname + '/renderer.js';

import { Transmitter, FrameMessageBus, Validation } from 'sn-electron-valence/Transmitter';
const { PropertyType } = Validation;
const messageBus = new FrameMessageBus();
const transmitter = new Transmitter(messageBus,
	{
    spellcheck: {
      type: PropertyType.OBJECT,
      properties: {
				reload: PropertyType.METHOD,
        showContextMenuForText: {
          type: PropertyType.METHOD,
          argValidators: [{ type: 'string', minLength: 1 } ]
        },
			},
    },
		isMacOS: PropertyType.VALUE,
    userDataPath: PropertyType.VALUE,
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
  let spellcheck;
  try {
    spellcheck = loadSpellcheck();
  } catch (e) {
    console.error("Error loading spellcheck", e);
  }

  transmitter.expose({
    spellcheck: spellcheck,
    userDataPath: remote.app.getPath('userData'),
    rendererPath: rendererPath,
    isMacOS: process.platform === "darwin",
    useSystemMenuBar: Store.instance().get("useSystemMenuBar"),

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
      return remote.getCurrentWindow().isMaximized()
    },
  });
}

function listenForIpcEvents() {

  const sendMessage = (message, payload = {}) => {
    window.postMessage(JSON.stringify({message, data: payload}), rendererPath);
  }

  ipcRenderer.on('update-available', function (event, data) {
    sendMessage("update-available", data);
  });

  ipcRenderer.on('download-backup', function (event, data) {
    sendMessage("download-backup", data);
  });

  ipcRenderer.on('finished-saving-backup', function (event, data) {
    sendMessage("finished-saving-backup", data);
  });

  ipcRenderer.on('window-blurred', function (event, data) {
    sendMessage("window-blurred", data);
  });

  ipcRenderer.on('window-focused', function (event, data) {
    sendMessage("window-focused", data);
  });

  ipcRenderer.on('install-component-complete', function (event, data) {
    sendMessage("install-component-complete", data);
  });
}

function loadSpellcheck() {
  let spellchecker;
  try {
    spellchecker = require('spellchecker');
  } catch (e) {
    console.log("Error loading spellChecker", e);
  }

  const EN_VARIANT = /^en/;

  // Prevent the spellchecker from showing contractions as errors.
  const ENGLISH_SKIP_WORDS = ['ain', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'mightn', 'mustn',
    'needn', 'oughtn', 'shan', 'shouldn', 'wasn', 'weren', 'wouldn'
  ];

  // We load locale this way and not via app.getLocale() because this call returns
  //   'es_ES' and not just 'es.' And hunspell requires the fully-qualified locale.
  const locale = osLocale.sync().replace('-', '_');

  // The LANG environment variable is how node spellchecker finds its default language:
  //   https://github.com/atom/node-spellchecker/blob/59d2d5eee5785c4b34e9669cd5d987181d17c098/lib/spellchecker.js#L29
  if (!process.env.LANG) {
    process.env.LANG = locale;
  }

  function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  };

  const simpleChecker = window.spellChecker = {
    spellCheck: debounce(function(words, callback) {
      const misspelled = words.filter(w => this.isMisspelled(w))
      callback(misspelled);
    }, 500),
    isMisspelled: function(text) {
      var misspelled = spellchecker.isMisspelled(text);

      // The idea is to make this as fast as possible. For the many, many calls which
      //   don't result in the red squiggly, we minimize the number of checks.
      if (!misspelled) {
        return false;
      }

      // // Only if we think we've found an error do we check the locale and skip list.
      if (locale.match(EN_VARIANT) && ENGLISH_SKIP_WORDS.includes(text)) {
        return false;
      }

      return true;
    },
    getSuggestions: function(text) {
      return spellchecker.getCorrectionsForMisspelling(text);
    },
    add: function(text) {
      spellchecker.add(text);
    }
  };

  return  {
    showContextMenuForText: async (selectedText) => {
      var isMisspelled = selectedText && simpleChecker.isMisspelled(selectedText);
      var spellingSuggestions = isMisspelled && simpleChecker.getSuggestions(selectedText).slice(0, 5);
      var menu = buildEditorContextMenu({
        isMisspelled: isMisspelled,
        spellingSuggestions: spellingSuggestions,
      });
      menu.popup({window: remote.getCurrentWindow()});
    },
    reload: async () => {
      webFrame.setSpellCheckProvider('en-US', simpleChecker);
    }
  }
}
