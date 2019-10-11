var hostProcess = process;
var hostRequire = require;
const { webFrame, ipcRenderer, remote } = require('electron')
const Store = require('./javascripts/main/store.js');

const path = require('path');
const osLocale = require('os-locale');
const os = require('os');
const semver = require('semver');

const buildEditorContextMenu = remote.require('electron-editor-context-menu');

process.once('loaded', function() {

  let spellcheck;
  try {
    spellcheck = loadSpellcheck();
  } catch (e) {
    console.error("Error loading spellcheck", e);
  }

  const Bridge = {
    ipcRenderer: ipcRenderer,
    userDataPath: remote.app.getPath('userData'),
    isMacOS: process.platform == "darwin",
    spellcheck: spellcheck,

    closeWindow: () => {
      remote.getCurrentWindow().close();
    },
    minimizeWindow: () => {
      remote.getCurrentWindow().minimize();
    },
    maximizeWindow: () => {
      remote.getCurrentWindow().maximize();
    },
    unmaximizeWindow: () => {
      remote.getCurrentWindow().unmaximize();
    },
    isWindowMaximized: () => {
      return remote.getCurrentWindow().isMaximized()
    },
    useSystemMenuBar: () => {
      return Store.instance().get("useSystemMenuBar");
    },
  }

  window.ElectronBridge = Bridge;

});


const loadSpellcheck = () => {
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
    showContextMenuForText: (selectedText) => {
      var isMisspelled = selectedText && simpleChecker.isMisspelled(selectedText);
      var spellingSuggestions = isMisspelled && simpleChecker.getSuggestions(selectedText).slice(0, 5);
      var menu = buildEditorContextMenu({
        isMisspelled: isMisspelled,
        spellingSuggestions: spellingSuggestions,
      });
      menu.popup({window: remote.getCurrentWindow()});
    },
    reload: () => {
      webFrame.setSpellCheckProvider('en-US', simpleChecker);
    }
  }
}
