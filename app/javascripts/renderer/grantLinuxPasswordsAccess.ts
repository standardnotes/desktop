import { ipcRenderer } from 'electron';
import { IpcMessages } from '../shared/ipcMessages';

/** Called from grantKeyChainAccess.html */
Object.assign(window, {
  quit() {
    ipcRenderer.send(IpcMessages.Quit);
  },
  useLocalStorage() {
    ipcRenderer.send(IpcMessages.UseLocalstorageForKeychain);
  },
});
