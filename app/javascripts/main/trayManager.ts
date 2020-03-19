import { app, Menu, Tray } from 'electron';
import path from 'path';
import { StoreKeys, Store } from './store';
import {
  AppName,
  TrayLabelHide,
  TrayLabelQuit,
  TrayLabelShow
} from './strings';
import { isLinux, isWindows } from './platforms';

const icon = path.join(__dirname, '/icon/Icon-256x256.png');

export interface TrayManager {
  shouldMinimizeToTray(): boolean;
  createTrayIcon(): void;
  destroyTrayIcon(): void;
}

export function createTrayManager(
  window: Electron.BrowserWindow,
  store: Store
): TrayManager {
  let tray: Tray | null = null;
  let updateContextMenu: (() => void) | null = null;

  function showWindow() {
    window.show();

    if (isLinux) {
      /* On some versions of GNOME the window may not be on top when
      restored. */
      window.setAlwaysOnTop(true);
      window.focus();
      window.setAlwaysOnTop(false);
    }
  }

  return {
    shouldMinimizeToTray() {
      return store.get(StoreKeys.MinimizeToTray);
    },

    createTrayIcon() {
      tray = new Tray(icon);
      tray.setToolTip(AppName);

      if (isWindows) {
        /* On Windows, right-clicking invokes the menu, as opposed to
        left-clicking for the other platforms. So we map left-clicking
        to the conventional action of showing the app. */
        tray.on('click', showWindow);
      }

      const SHOW_WINDOW_ID = 'SHOW_WINDOW';
      const HIDE_WINDOW_ID = 'HIDE_WINDOW';
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
          type: 'separator'
        },
        {
          label: TrayLabelQuit,
          click() {
            app.quit();
          }
        }
      ]);

      updateContextMenu = function updateContextMenu() {
        if (window.isVisible()) {
          trayContextMenu.getMenuItemById(SHOW_WINDOW_ID).visible = false;
          trayContextMenu.getMenuItemById(HIDE_WINDOW_ID).visible = true;
        } else {
          trayContextMenu.getMenuItemById(SHOW_WINDOW_ID).visible = true;
          trayContextMenu.getMenuItemById(HIDE_WINDOW_ID).visible = false;
        }

        tray!.setContextMenu(trayContextMenu);
      };
      updateContextMenu(); // initialization

      window.on('hide', updateContextMenu);
      window.on('focus', updateContextMenu);
      window.on('blur', updateContextMenu);
    },

    destroyTrayIcon() {
      if (process.env.NODE_ENV === 'development') {
        /** Check our state */
        if (updateContextMenu === null) {
          throw new Error('updateContextMenu === null');
        }
        if (tray === null) throw new Error('tray === null');
      }

      window.off('hide', updateContextMenu!);
      window.off('focus', updateContextMenu!);
      window.off('blur', updateContextMenu!);
      tray!.destroy();
      tray = null;
      updateContextMenu = null;
    }
  };
}
