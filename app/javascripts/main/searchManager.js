var {ipcMain, remote, dialog, app} = require('electron');

class SearchManager {

  constructor() {
    ipcMain.on('search-text', (event, text) => {
      if(!text || text.length == 0) {
        this.window.webContents.stopFindInPage('clearSelection');
      } else {
        // This option arrangement is required to avoid an issue where clicking on a
        // different note causes scroll to jump.
        this.window.webContents.findInPage(text, {forward: true, findNext: false});
      }
    });
  }

  setWindow(window) {
    this.window = window;
  }

}

export default new SearchManager();
