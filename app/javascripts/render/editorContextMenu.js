(function () {
  var electron = require('electron');
  var {remote, app} = require('electron');

  var buildEditorContextMenu = remote.require('electron-editor-context-menu');

  var desktopManager = angular.element(document).injector().get('desktopManager');

  function contextEvent(e) {
    let menu = buildEditorContextMenu();

    // The 'contextmenu' event is emitted after 'selectionchange' has fired but possibly before the
    // visible selection has changed. Try to wait to show the menu until after that, otherwise the
    // visible selection will update after the menu dismisses and look weird.
    setTimeout(function() {
      menu.popup({window: remote.getCurrentWindow()});
    }, 30);
  }

  function addContextMenuTo(iframe) {
    if(iframe) {
      // remove context menu event
      iframe.contentWindow.removeEventListener("contextmenu", contextEvent);

      // add content menu event
      iframe.contentWindow.addEventListener("contextmenu", contextEvent);
    }
  }

  // register activation observer to be notified when a component is registered
  desktopManager.desktop_registerActivationObserver((component) => {
    if(component.window && component.window.frameElement) {
      // safely try to register the event on this component's iframe
      try {
        addContextMenuTo(component.window.frameElement);
      } catch (e) {
        console.error(e);
      }
    }
  });
})();