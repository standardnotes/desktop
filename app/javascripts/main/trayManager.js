const path = require('path');
const {Tray, Menu, app} = require('electron');

const icon = path.join(__dirname, `../../icon/Icon-256x256.png`);

class TrayManager {
  setWindow(window) {
    this.window = window;
  }

  createTrayIcon () {
    const tray = new Tray(icon);

    tray.toggleWindowVisibility = (show) => {
      if (this.window) {
        if (!show) {
          this.window.hide();
        } else {
          this.window.show();

          // On some versions of GNOME the window may not be on top when restored.
          this.window.setAlwaysOnTop(true);
          this.window.focus();
          this.window.setAlwaysOnTop(false);
        }
      }
    };

    tray.updateContextMenu = () => {
      if (this.window.isVisible()) {
        trayContextMenu.items[0].visible = false;
        trayContextMenu.items[1].visible = true;
      } else {
        trayContextMenu.items[0].visible = true;
        trayContextMenu.items[1].visible = false;
      }

      tray.setContextMenu(trayContextMenu);
    };

    const trayContextMenu = Menu.buildFromTemplate([{
      id: 'ShowWindow',
      label: 'Show',
      click: tray.toggleWindowVisibility.bind(this, true)
    }, {
      id: 'HideWindow',
      label: 'Hide',
      click: tray.toggleWindowVisibility.bind(this, false)
    },
    {
      type: 'separator'
    },
    {
      id: 'quit',
      label: 'Quit',
      click: app.quit.bind(app)
    }]);

    tray.setToolTip('Standard Notes');
    tray.setContextMenu(trayContextMenu);

    tray.on('click', () => {
      tray.popUpContextMenu();
    });

    this.bindListeners(tray);
  }

  bindListeners(tray) {
    this.window.on('hide', () => {
      tray.updateContextMenu();
    });

    this.window.on('focus', () => {
      tray.updateContextMenu();
    });
  }
}

export default new TrayManager();
