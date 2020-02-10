import { Store, StoreKeys } from "./store";
import { Platforms } from "../../application";
const path = require("path");
const { Tray, Menu, app } = require("electron");
const icon = path.join(__dirname, `../../icon/Icon-256x256.png`);

export class TrayManager {
  constructor(window, platform) {
    this.window = window;
    this.platform = platform;
    this.tray = null;
  }

  shouldMinimizeToTray() {
    return Store.get(StoreKeys.MinimizeToTray);
  }

  createTrayIcon() {
    const tray = new Tray(icon);
    this.tray = tray;

    tray.toggleWindowVisibility = show => {
      if (this.window) {
        if (show) {
          this.window.show();

          // On some versions of GNOME the window may not be on top when restored.
          this.window.setAlwaysOnTop(true);
          this.window.focus();
          this.window.setAlwaysOnTop(false);
        } else {
          this.window.hide();
        }
      }
    };

    const trayContextMenu = Menu.buildFromTemplate([
      {
        id: "ShowWindow",
        label: "Show",
        click() {
          tray.toggleWindowVisibility(true);
        }
      },
      {
        id: "HideWindow",
        label: "Hide",
        click() {
          tray.toggleWindowVisibility(false);
        }
      },
      {
        type: "separator"
      },
      {
        id: "quit",
        label: "Quit",
        click() {
          app.quit();
        }
      }
    ]);

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

    tray.updateContextMenu();
    tray.setToolTip("Standard Notes");
    tray.setContextMenu(trayContextMenu);

    if (this.platform === Platforms.Windows) {
      tray.on("click", () => tray.toggleWindowVisibility(true));
    }

    this.window.on("hide", tray.updateContextMenu);
    this.window.on("focus", tray.updateContextMenu);
    this.window.on("blur", tray.updateContextMenu);
  }

  removeTrayIcon() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
