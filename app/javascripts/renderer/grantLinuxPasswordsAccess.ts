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

document.addEventListener('DOMContentLoaded', () => {
  const learnMoreButton = document.getElementById('learn-more')!;
  const moreInfo = document.getElementById('more-info')!;

  learnMoreButton.addEventListener('click', (event) => {
    ipcRenderer.send(IpcMessages.LearnMoreAboutKeychainAccess);
    event.preventDefault();
    moreInfo.style.display = 'block';
    learnMoreButton.style.display = 'none';
  });
});
