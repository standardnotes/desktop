'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require('electron'),
    ipcMain = _require.ipcMain,
    remote = _require.remote,
    dialog = _require.dialog,
    app = _require.app;

var fs = require('fs');
var path = require('path');
var Store = require('./store.js');

var store = new Store({
  configName: 'user-preferences',
  defaults: {}
});

var Archives = function () {
  function Archives() {
    var _this = this;

    _classCallCheck(this, Archives);

    ipcMain.on('data-archive', function (event, data) {
      if (data) {
        _this.writeDataToFile(data);
      } else {
        console.log("Empty data, not writing.");
      }
    });

    this.backupsLocation = store.get("backupsLocation");
  }

  _createClass(Archives, [{
    key: 'defaultLocation',
    value: function defaultLocation() {
      return path.join(app.getPath('home'), "Standard Notes Backups");
    }
  }, {
    key: 'getBackupsLocation',
    value: function getBackupsLocation() {
      if (!this.backupsLocation) {
        this.backupsLocation = this.defaultLocation();
      }
      return this.backupsLocation;
    }
  }, {
    key: 'changeBackupsLocation',
    value: function changeBackupsLocation() {
      var _this2 = this;

      dialog.showOpenDialog({
        properties: ['openDirectory', 'showHiddenFiles', 'createDirectory']
      }, function (paths) {
        var path = paths[0];
        _this2.backupsLocation = path;
        store.set("backupsLocation", path);
        _this2.performBackup();
      });
    }
  }, {
    key: 'writeDataToFile',
    value: function writeDataToFile(data) {
      var dir = this.getBackupsLocation();
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }

      var find = ':';
      var re = new RegExp(find, 'g');
      var name = new Date().toString().replace(re, "-") + ".txt";

      var filePath = path.join(dir, name);

      fs.writeFile(filePath, data, function (err) {
        if (err) {
          console.log("An error ocurred creating the file " + err.message);
        } else {
          console.log("The file has been succesfully saved");
        }
      });
    }
  }, {
    key: 'setWindow',
    value: function setWindow(window) {
      this.window = window;
    }
  }, {
    key: 'beginBackups',
    value: function beginBackups() {
      var _this3 = this;

      if (this.interval) {
        clearInterval(this.interval);
      }

      this.performBackup();

      var hoursInterval = 12; // Every X hours
      var seconds = hoursInterval * 60 * 60;
      var milliseconds = seconds * 1000;
      this.interval = setInterval(function () {
        _this3.performBackup();
      }, 4000);
    }
  }, {
    key: 'performBackup',
    value: function performBackup() {
      this.window.webContents.send("download-backup");
    }
  }]);

  return Archives;
}();

exports.default = new Archives();