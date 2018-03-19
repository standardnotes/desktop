var {ipcMain, remote, dialog, app} = require('electron');

class SearchManager {

  constructor() {
    ipcMain.on('search-text', (event, text) => {
      if(!text || text.length == 0) {
        this.window.webContents.stopFindInPage('clearSelection');
      } else {
        this.window.webContents.findInPage(text);
      }
    });
  }

  setWindow(window) {
    this.window = window;
  }

}

export default new SearchManager();
