import { Store, StoreKeys } from './store';
import { WebContents } from 'electron';

export function initializeZoomManager(
  webContents: WebContents,
  store: Store
) {
  webContents.on('dom-ready', () => {
    const zoomFactor = store.get(StoreKeys.ZoomFactor);
    if (zoomFactor) {
      webContents.zoomFactor = zoomFactor;
    }
  });

  webContents.on('zoom-changed', () => {
    const zoomFactor = webContents.zoomFactor;
    store.set(StoreKeys.ZoomFactor, zoomFactor);
  });
}
