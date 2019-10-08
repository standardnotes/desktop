// Original Source:
// https://github.com/WhisperSystems/Signal-Desktop/blob/development/js/spell_check.js

(function () {
  const electron = require('electron');
  const {remote, app} = require('electron');
  // var remote = electron.remote;
  // var app = remote.app;
  const webFrame = electron.webFrame;
  const path = require('path');

  const osLocale = require('os-locale');
  const os = require('os');
  const semver = require('semver');
  const spellchecker = require('spellchecker');
  // `remote.require` since `Menu` is a main-process module.
  const buildEditorContextMenu = remote.require('electron-editor-context-menu');

  const EN_VARIANT = /^en/;

  // Prevent the spellchecker from showing contractions as errors.
  const ENGLISH_SKIP_WORDS = ['ain', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'mightn', 'mustn',
    'needn', 'oughtn', 'shan', 'shouldn', 'wasn', 'weren', 'wouldn'
  ];

  function setupLinux(locale) {
    if (process.env.HUNSPELL_DICTIONARIES || locale !== 'en_US') {
      // apt-get install hunspell-<locale> can be run for easy access to other dictionaries
      var location = process.env.HUNSPELL_DICTIONARIES || '/usr/share/hunspell';

      console.log('Detected Linux. Setting up spell check with locale', locale, 'and dictionary location', location);
      spellchecker.setDictionary(locale, location);
    } else {
      console.log('Detected Linux. Using default en_US spell check dictionary');
    }
  }

  function setupWin7AndEarlier(locale) {
    if (process.env.HUNSPELL_DICTIONARIES || locale !== 'en_US') {
      var location = process.env.HUNSPELL_DICTIONARIES;

      console.log('Detected Windows 7 or below. Setting up spell-check with locale', locale, 'and dictionary location', location);
      spellchecker.setDictionary(locale, location);
    } else {
      console.log('Detected Windows 7 or below. Using default en_US spell check dictionary');
    }
  }

  // We load locale this way and not via app.getLocale() because this call returns
  //   'es_ES' and not just 'es.' And hunspell requires the fully-qualified locale.
  const locale = osLocale.sync().replace('-', '_');

  // The LANG environment variable is how node spellchecker finds its default language:
  //   https://github.com/atom/node-spellchecker/blob/59d2d5eee5785c4b34e9669cd5d987181d17c098/lib/spellchecker.js#L29
  if (!process.env.LANG) {
    process.env.LANG = locale;
  }

  if (process.platform === 'linux') {
    setupLinux(locale);
  } else if (process.platform === 'windows' && semver.lt(os.release(), '8.0.0')) {
    setupWin7AndEarlier(locale);
  } else {
    // OSX and Windows 8+ have OS-level spellcheck APIs
    console.log('Using OS-level spell check API with locale', process.env.LANG);
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

  var simpleChecker = window.spellChecker = {
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

  function loadSpellcheckIntoFrames() {
    webFrame.setSpellCheckProvider('en-US', simpleChecker);
  }

  loadSpellcheckIntoFrames();

  function getContextMenuForText(selectedText) {
    var isMisspelled = selectedText && simpleChecker.isMisspelled(selectedText);
    var spellingSuggestions = isMisspelled && simpleChecker.getSuggestions(selectedText).slice(0, 5);
    var menu = buildEditorContextMenu({
      isMisspelled: isMisspelled,
      spellingSuggestions: spellingSuggestions,
    });
    return menu;
  }

  window.addEventListener('contextmenu', function(e) {
    // Only show the context menu in text editors.
    if (!e.target.closest('textarea, input, [contenteditable="true"]')) {
      return;
    }

    let selectedText = window.getSelection().toString();
    let menu = getContextMenuForText(selectedText);

    // The 'contextmenu' event is emitted after 'selectionchange' has fired but possibly before the
    // visible selection has changed. Try to wait to show the menu until after that, otherwise the
    // visible selection will update after the menu dismisses and look weird.
    setTimeout(function() {
      menu.popup({window: remote.getCurrentWindow()});
    }, 30);
  });



  /*
   Context menus and spellcheck for editor extensions
  */

  var desktopManager = angular.element(document).injector().get('desktopManager');

  function editorExtensionContextEvent(e) {
    let selectedText = e.view.getSelection().toString();
    let menu = getContextMenuForText(selectedText);

    // The 'contextmenu' event is emitted after 'selectionchange' has fired but possibly before the
    // visible selection has changed. Try to wait to show the menu until after that, otherwise the
    // visible selection will update after the menu dismisses and look weird.
    setTimeout(function() {
      menu.popup({window: remote.getCurrentWindow()});
    }, 30);
  }

  function addContextMenuTo(uuid) {
    let componentFrame = document.querySelector('[data-component-id="' + uuid + '"]');
    if(componentFrame) {
      // add content menu event
      componentFrame.contentWindow.addEventListener("contextmenu", editorExtensionContextEvent);
    }
  }

  // register activation observer to be notified when a component is registered
  desktopManager.desktop_registerComponentActivationObserver((component) => {
    try {
      // Reload spellcheck integration after iframe is loaded (https://github.com/electron/electron/issues/13514#issuecomment-445396551)
      loadSpellcheckIntoFrames();

      addContextMenuTo(component.uuid);
    } catch (e) {
      console.error(e);
    }
  });
})();
