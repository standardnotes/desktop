const store = require('./store')

class ZoomManager {

  setWindow(window) {
    this.window = window;
    this.bind();
  }

  bind() {
    // We can't rely on ready-to-show as it doesn't fire consistently
    // See: https://github.com/electron/electron/issues/7779
    this.window.webContents.on('dom-ready', () => {
      const zoomFactor = store.instance().get('zoomFactor');
      if (zoomFactor) {
        this.window.webContents.setZoomFactor(zoomFactor);
      }
    })

    this.window.on('close', () => {
      // Persist the zoom level
      this.window.webContents.getZoomFactor((zoomFactor) => {
        store.instance().set('zoomFactor', zoomFactor);
      });
    })
  }
}

export default new ZoomManager();
