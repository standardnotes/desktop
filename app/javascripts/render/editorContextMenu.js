(function () {
  var electron = require('electron');
  var {remote, app} = require('electron');

  var buildEditorContextMenu = remote.require('electron-editor-context-menu');

  function addContextMenuTo(component) {
    let iframe = component.querySelectorAll("iframe")[0];

    if(iframe) {
      // TODO check if it's already added or not?

      if(iframe.contentWindow.contextmenu) {
        iframe.removeEventListener('contextmenu', changesObserved);
      }

      iframe.contentWindow.addEventListener('contextmenu', function(e) {
        let menu = buildEditorContextMenu();

        // The 'contextmenu' event is emitted after 'selectionchange' has fired but possibly before the
        // visible selection has changed. Try to wait to show the menu until after that, otherwise the
        // visible selection will update after the menu dismisses and look weird.
        setTimeout(function() {
          menu.popup({window: remote.getCurrentWindow()});
        }, 30);
      });
    }
  }

  var rootNode = document; //.getElementById("editor-column");
  var changesObserved = function(mutationsList, observer) {
    var components = rootNode.querySelectorAll("component-view");

    components.forEach((component) => {
      addContextMenuTo(component);
    });
  }

  var observer = new MutationObserver(changesObserved);
  observer.observe(rootNode, {
    childList: true,
    subtree: true,
    attributefilter: "component-id"
  });
})();