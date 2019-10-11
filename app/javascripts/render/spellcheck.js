// Original Source:
// https://github.com/WhisperSystems/Signal-Desktop/blob/development/js/spell_check.js

(function () {
  const spellcheck = window.ElectronBridge.spellcheck;

  spellcheck.reload();

  window.addEventListener('contextmenu', function(e) {
    // Only show the context menu in text editors.
    if (!e.target.closest('textarea, input, [contenteditable="true"]')) {
      return;
    }

    let selectedText = window.getSelection().toString();

    // The 'contextmenu' event is emitted after 'selectionchange' has fired but possibly before the
    // visible selection has changed. Try to wait to show the menu until after that, otherwise the
    // visible selection will update after the menu dismisses and look weird.
    setTimeout(function() {
      spellcheck.showContextMenuForText(selectedText);
    }, 30);
  });
})();
