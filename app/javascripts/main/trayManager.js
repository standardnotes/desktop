import { Store, StoreKeys } from "./store";
import { Platforms } from "../../application";
import {
  AppName,
  TrayLabelShow,
  TrayLabelHide,
  TrayLabelQuit
} from "./strings";
const path = require("path");
const { Tray, Menu, app } = require("electron");
const icon = path.join(__dirname, `../../icon/Icon-256x256.png`);

const WindowEvents = {
  Hide: "hide",
  Focus: "focus",
  Blur: "blur"
};

export function createTrayManager(window, store, platform) {
  let tray = null;

  return {
    shouldMinimizeToTray() {
      return store.get(StoreKeys.MinimizeToTray);
    },

    createTrayIcon() {
      tray = new Tray(icon);
      tray.setToolTip(AppName);

      const showWindow = () => {
        window.show();

        if (platform === Platforms.Linux) {
          /* On some versions of GNOME the window may not be on top when
          restored. */
          window.setAlwaysOnTop(true);
          window.focus();
          window.setAlwaysOnTop(false);
        }
      };

      if (platform === Platforms.Windows) {
        /* On Windows, right-clicking invokes the menu, as opposed to
        left-clicking for the other platforms. So we map left-clicking
        to the conventional action of showing the app. */
        tray.on("click", showWindow);
      }

      const SHOW_WINDOW_ID = "SHOW_WINDOW";
      const HIDE_WINDOW_ID = "HIDE_WINDOW";
      const trayContextMenu = Menu.buildFromTemplate([
        {
          id: SHOW_WINDOW_ID,
          label: TrayLabelShow,
          click: showWindow
        },
        {
          id: HIDE_WINDOW_ID,
          label: TrayLabelHide,
          click() {
            window.hide();
          }
        },
        {
          type: "separator"
        },
        {
          label: TrayLabelQuit,
          click() {
            app.quit();
          }
        }
      ]);

      tray.updateContextMenu = () => {
        if (window.isVisible()) {
          trayContextMenu.getMenuItemById(SHOW_WINDOW_ID).visible = false;
          trayContextMenu.getMenuItemById(HIDE_WINDOW_ID).visible = true;
        } else {
          trayContextMenu.getMenuItemById(SHOW_WINDOW_ID).visible = true;
          trayContextMenu.getMenuItemById(HIDE_WINDOW_ID).visible = false;
        }

        tray.setContextMenu(trayContextMenu);
      };
      tray.updateContextMenu(); // initialization

      window.on(WindowEvents.Hide, tray.updateContextMenu);
      window.on(WindowEvents.Focus, tray.updateContextMenu);
      window.on(WindowEvents.Blur, tray.updateContextMenu);
    },

    destroyTrayIcon() {
      window.off(WindowEvents.Hide, tray.updateContextMenu);
      window.off(WindowEvents.Focus, tray.updateContextMenu);
      window.off(WindowEvents.Blur, tray.updateContextMenu);
      tray.destroy();
      tray = null;
    }
  };
}
