'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var shell = require('electron').shell;

var _require = require('electron'),
    app = _require.app,
    Menu = _require.Menu;

var MenuManager = function () {
  function MenuManager() {
    _classCallCheck(this, MenuManager);
  }

  _createClass(MenuManager, [{
    key: 'loadMenu',
    value: function loadMenu(window, archiveManager) {
      var template = [{
        label: 'Edit',
        submenu: [{
          role: 'undo'
        }, {
          role: 'redo'
        }, {
          type: 'separator'
        }, {
          role: 'cut'
        }, {
          role: 'copy'
        }, {
          role: 'paste'
        }, {
          role: 'pasteandmatchstyle'
        }, {
          role: 'selectall'
        }]
      }, {
        label: 'View',
        submenu: [{
          role: 'reload'
        }, {
          role: 'toggledevtools'
        }, {
          type: 'separator'
        }, {
          role: 'resetzoom'
        }, {
          role: 'zoomin'
        }, {
          role: 'zoomout'
        }, {
          type: 'separator'
        }, {
          role: 'togglefullscreen'
        }, {
          visible: process.platform === 'darwin' ? false : true,
          label: 'Hide Menu Bar',
          accelerator: 'Alt + m',
          click: function click() {
            if (window.isMenuBarVisible(true)) {
              window.setMenuBarVisibility(false);
            } else {
              window.setMenuBarVisibility(true);
            }
          }
        }]
      }, {
        role: 'window',
        submenu: [{
          role: 'minimize'
        }, {
          role: 'close'
        }]
      }, {
        label: 'Backups',
        submenu: [{ label: 'Change Backups Location', click: function click() {
            archiveManager.changeBackupsLocation();
          }
        }, { label: 'Open Backups Location', click: function click() {
            shell.openItem(archiveManager.getBackupsLocation());
          }
        }]
      }, {
        role: 'help',
        submenu: [{
          label: 'GitHub',
          click: function click() {
            shell.openExternal('https://github.com/standardnotes');
          }
        }, {
          label: 'Slack',
          click: function click() {
            shell.openExternal('https://standardnotes.org/slack');
          }
        }, {
          label: 'Website',
          click: function click() {
            shell.openExternal('https://standardnotes.org');
          }
        }, {
          label: 'Support',
          click: function click() {
            shell.openExternal('mailto:hello@standardnotes.org');
          }
        }, {
          label: 'Clear Cache and Reload',
          click: function click() {
            window.webContents.session.clearCache(function () {
              window.reload();
            });
          }
        }, {
          label: 'Version: ' + app.getVersion(),
          click: function click() {
            shell.openExternal('https://github.com/standardnotes/desktop/releases');
          }
        }]
      }];

      if (process.platform === 'darwin') {
        template.unshift({
          label: app.getName(),
          submenu: [{
            role: 'about'
          }, {
            type: 'separator'
          }, {
            role: 'services',
            submenu: []
          }, {
            type: 'separator'
          }, {
            role: 'hide'
          }, {
            role: 'hideothers'
          }, {
            role: 'unhide'
          }, {
            type: 'separator'
          }, {
            role: 'quit'
          }]
        });
        // Edit menu.
        template[1].submenu.push({
          type: 'separator'
        }, {
          label: 'Speech',
          submenu: [{
            role: 'startspeaking'
          }, {
            role: 'stopspeaking'
          }]
        });
        // Window menu.
        template[3].submenu = [{
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        }, {
          label: 'Minimize',
          accelerator: 'CmdOrCtrl+M',
          role: 'minimize'
        }, {
          label: 'Zoom',
          role: 'zoom'
        }, {
          type: 'separator'
        }, {
          label: 'Bring All to Front',
          role: 'front'
        }];
      }

      var menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
    }
  }]);

  return MenuManager;
}();

exports.default = new MenuManager();