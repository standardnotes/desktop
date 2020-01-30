import { Store, StoreKeys } from './store';

export class ZoomManager {
  constructor(window) {
    this.window = window;
    this.bind();
  }

  bind() {
    this.window.webContents.on('dom-ready', () => {
      const zoomFactor = Store.get(StoreKeys.ZoomFactor);
      if (zoomFactor) {
        this.window.webContents.setZoomFactor(zoomFactor);
      }
    });

    this.window.on('close', () => {
      this.window.webContents.getZoomFactor((zoomFactor) => {
        Store.set(StoreKeys.ZoomFactor, zoomFactor);
      });
    });
  }
}
