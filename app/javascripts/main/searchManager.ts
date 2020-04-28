import { ipcMain, WebContents } from 'electron';
import { IpcMessages } from '../shared/ipcMessages';

export function initializeSearchManager(webContents: WebContents) {
  ipcMain.on(IpcMessages.SearchText, (_event, { text }: { text: string }) => {
    webContents.stopFindInPage('clearSelection');
    if (text && text.length > 0) {
      // This option arrangement is required to avoid an issue where clicking on a
      // different note causes scroll to jump.
      webContents.findInPage(text, { forward: true, findNext: false });
    }
  });
}
