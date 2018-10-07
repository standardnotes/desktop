(function () {
  var electron = require('electron');
  var {remote, app} = require('electron');

  var buildEditorContextMenu = remote.require('electron-editor-context-menu');

  function contextEvent(e) {
    let menu = buildEditorContextMenu();

    // The 'contextmenu' event is emitted after 'selectionchange' has fired but possibly before the
    // visible selection has changed. Try to wait to show the menu until after that, otherwise the
    // visible selection will update after the menu dismisses and look weird.
    setTimeout(function() {
      menu.popup({window: remote.getCurrentWindow()});
    }, 30);
  }

  function addContextMenuTo(component) {
    let iframe = component.querySelector("iframe");

    if(iframe) {
      // remove context menu event
      iframe.contentWindow.removeEventListener("contextmenu", contextEvent);

      // add content menu event
      iframe.contentWindow.addEventListener("contextmenu", contextEvent);
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
    subtree: true,
    attributes: true,
    attributefilter: ["data-component-id"]
  });
})();