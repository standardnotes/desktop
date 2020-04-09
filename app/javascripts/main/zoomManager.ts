import { BrowserWindow } from 'electron';
import { Store, StoreKeys } from './store';

export function initializeZoomManager(window: BrowserWindow, store: Store) {
  window.webContents.on('dom-ready', () => {
    const zoomFactor = store.get(StoreKeys.ZoomFactor);
    if (zoomFactor) {
      window.webContents.zoomFactor = zoomFactor;
    }
  });

  window.on('close', () => {
    const zoomFactor = window.webContents.zoomFactor;
    store.set(StoreKeys.ZoomFactor, zoomFactor);
  });
}
