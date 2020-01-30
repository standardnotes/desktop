const { ipcMain } = require('electron');

export class SearchManager {

  constructor(window) {
    this.window = window;
    ipcMain.on('search-text', (event, data) => {
      const text = data.text;
      this.window.webContents.stopFindInPage('clearSelection');
      if (text && text.length > 0) {
        // This option arrangement is required to avoid an issue where clicking on a
        // different note causes scroll to jump.
        this.window.webContents.findInPage(
          text, 
          { forward: true, findNext: false }
        );
      }
    });
  }
}
