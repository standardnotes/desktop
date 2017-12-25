var {ipcMain, remote, dialog, app} = require('electron');
var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var request = require("request");
var appPath = app.getPath('userData');
var AdmZip = require('adm-zip');
var compareVersions = require('compare-versions');

class PackageManager {

  constructor() {
    ipcMain.on('install-component', (event, data) => {
      this.installComponent(data, (component) => {
        this.window.webContents.send("install-component-complete", component);
      });
    });

    ipcMain.on('sync-components', (event, data) => {
      this.syncComponents(data);
    });
  }

  setWindow(window) {
    this.window = window;
  }

  pathsForComponent(component) {
    let relativePath = "packages/" + component.content.package_info.identifier;
    return {
      extractionPath: appPath + "/" + component.content.name + ".zip",
      relativePath: relativePath,
      absolutePath: appPath + "/" + relativePath
    }
  }

  installComponent(component, callback) {
    console.log("Installing component", component);
    let paths = this.pathsForComponent(component);

    this.downloadFile(component.content.package_info.download_url, paths.extractionPath, () => {
      // Extract contents
      this.unzipFile(paths.extractionPath, paths.absolutePath, (err) => {
        if(!err) {
          // Make package.json file with component.content.package_info
          fs.writeFile(paths.absolutePath + "/package.json", JSON.stringify(component.content.package_info, null, 2), 'utf8', (err) => {
            if(err) console.log(err);
          });
        }
      });

      component.content.url = "sn://" + paths.relativePath + "/index.html";
      callback && callback(component);
    });
  }

  syncComponents(components) {
    // Incoming `components` are what should be installed. For every component, check
    // the filesystem and see if that component is installed. If not, install it.

    for(let component of components) {
      if(!component.content.package_info || !component.content.local) { continue; }

      let paths = this.pathsForComponent(component);
      fs.stat(paths.absolutePath, (err, stats) => {
        if(err && err.code === 'ENOENT') {
          this.installComponent(component);
        } else if(component.content.autoupdate) {
          // Check for updates
          this.checkForUpdate(component);
        }
      })
    }
  }

  checkForUpdate(component) {
    var latestURL = component.content.package_info.latest_url;
    if(!latestURL) {
      console.log("No latest url, skipping update", component);
      return;
    }
    console.log("Checking for update for", component);
    request.get(latestURL, (error, response, body) => {
        console.log(response.statusCode) // 200
        console.log("Latest response", body);
        var body = JSON.parse(body);
        if(compareVersions(body.version, component.content.package_info.version) == 1) {
          // Latest version is greater than installed version
          console.log("Downloading new version", body.download_url);
          component.content.package_info.download_url = body.download_url;
          component.content.package_info.version = body.version;
          this.installComponent(component, (component) => {
            this.window.webContents.send("update-component-complete", component);
          });
        }
      })
  }

  downloadFile(url, filePath, callback) {
    request(url)
      .pipe(fs.createWriteStream(filePath))
      .on('close', function () {
        console.log('File written!');
        callback()
      });
  }

  unzipFile(filePath, dest, callback) {
    fs.readFile(filePath, 'utf8', function (err, data) {
      if(err) {
         console.log(err);
         callback(err);
         return;
      }

      var zip = new AdmZip(filePath);
      zip.extractAllTo(dest, true /*overwrite*/);
      fs.unlink(filePath);
      callback();
    });
  }

}

export default new PackageManager();
