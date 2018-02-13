var {ipcMain, remote, dialog, app} = require('electron');
var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var request = require("request");
var appPath = app.getPath('userData');
var AdmZip = require('adm-zip');
var compareVersions = require('compare-versions');

let ExtensionsFolderName = "Extensions";

let MappingFileLocation = appPath + `/${ExtensionsFolderName}/mapping.json`;

class PackageManager {

  constructor() {
    ipcMain.on('install-component', (event, data) => {
      this.installComponent(data);
    });

    ipcMain.on('sync-components', (event, data) => {
      this.syncComponents(data);
    });
  }

  setWindow(window) {
    this.window = window;
  }

  pathsForComponent(component) {
    let relativePath = `${ExtensionsFolderName}/` + component.content.package_info.identifier;
    return {
      downloadPath: appPath + `/${ExtensionsFolderName}/downloads/` + component.content.name + ".zip",
      relativePath: relativePath,
      absolutePath: appPath + "/" + relativePath
    }
  }

  installComponent(component) {
    let downloadUrl = component.content.package_info.download_url;
    if(!downloadUrl) {
      return;
    }

    console.log("Installing component", component.content.name, downloadUrl);

    let callback = (installedComponent, error) => {
      console.log("Calling installComponent callback with error", error);
      this.window.webContents.send("install-component-complete", {component: installedComponent, error: error});
    }

    let paths = this.pathsForComponent(component);

    this.downloadFile(downloadUrl, paths.downloadPath, (error) => {
      if(!error) {
        // Delete any existing content, especially in the case of performing an update
        this.deleteAppRelativeDirectory(paths.relativePath);

        // Extract contents
        this.unzipFile(paths.downloadPath, paths.absolutePath, (err) => {
          if(!err) {
            this.unnestPackageContents(paths.absolutePath, () => {
              // Find out main file
              this.readJsonFile(paths.absolutePath + "/package.json", (response, error) => {
                var main;
                if(response) {
                  if(response.sn) { main = response["sn"]["main"]; }
                  if(response.version) { component.content.package_info.version = response.version; }
                }
                if(!main) { main = "index.html"; }

                component.content.local_url = "sn://" + paths.relativePath + "/" + main;
                callback(component);

                // Update mapping file
                this.updateMappingFile(component.uuid, paths.relativePath);
              })
            })
          } else {
            // Unzip error
            console.log("Unzip error for", component.content.name);
            callback(component, {tag: "error-unzipping"})
          }
        });
      } else {
        // Download error
        callback(component, {tag: "error-downloading"})
      }
    });
  }

  /*
    Maintains a JSON file which maps component ids to their installation location. This allows us to uninstall components
    when they are deleted and do not have any `content`. We only have their uuid to go by.
   */
  updateMappingFile(componentId, componentPath) {
    this.readJsonFile(MappingFileLocation, (response, error) => {
      if(!response) response = {};

      var obj = response[componentId] || {};
      obj["location"] = componentPath;
      response[componentId] = obj;

      fs.writeFile(MappingFileLocation, JSON.stringify(response, null, 2), 'utf8', (err) => {
        if(err) console.log("Mapping file save error:", err);
      });
    })
  }

  syncComponents(components) {
    // Incoming `components` are what should be installed. For every component, check
    // the filesystem and see if that component is installed. If not, install it.

    console.log(`Syncing components: ${components.length}`);

    for(let component of components) {
      if(component.deleted) {
        // Uninstall
        this.uninstallComponent(component);
        continue;
      }

      if(!component.content.package_info) {
        console.log("Package info is null, continuing");
        continue;
      }

      let paths = this.pathsForComponent(component);
      fs.stat(paths.absolutePath, (err, stats) => {
        var doesntExist = err && err.code === 'ENOENT';
        if(doesntExist || !component.content.local_url) {
          // Doesn't exist, install it
          this.installComponent(component);
        } else if(!component.content.autoupdateDisabled) {
          // Check for updates
          this.checkForUpdate(component);
        } else {
          // Already exists or update update disabled
          console.log("Not installing component", component.content.name,  "Already exists?", !doesntExist);
        }
      })
    }
  }

  checkForUpdate(component) {
    var latestURL = component.content.package_info.latest_url;
    if(!latestURL) {
      console.log("No latest url, skipping update", component.content.name);
      return;
    }
    // console.log("Checking for update for", component.content.name, "current version", component.content.package_info.version);
    request.get(latestURL, (error, response, body) => {
      if(response.statusCode == 200) {
        var payload = JSON.parse(body);
        if(payload && payload.version && compareVersions(payload.version, component.content.package_info.version) == 1) {
          // Latest version is greater than installed version
          console.log("Downloading new version", payload.download_url);
          component.content.package_info.download_url = payload.download_url;
          component.content.package_info.version = payload.version;
          this.installComponent(component);
        }
      }
    })
  }

  uninstallComponent(component) {
    console.log("UNINSTALLING COMPONENT", component.uuid);
    this.readJsonFile(MappingFileLocation, (response, error) => {
      if(!response) {
        // No mapping.json means nothing is installed
        return;
      }

      // Get installation location
      var mapping = response[component.uuid];
      if(!mapping || !mapping.location) {
        return;
      }

      let location = mapping["location"];

      this.deleteAppRelativeDirectory(location);

      delete response[component.uuid];

      fs.writeFile(MappingFileLocation, JSON.stringify(response, null, 2), 'utf8', (err) => {
        if(err) console.log("Uninstall, mapping file save error:", err);
      });
    })
  }


  /*
    File/Network Operations
  */

  readJsonFile(path, callback) {
    fs.readFile(path, 'utf8', function (err, data) {
      if(err) {
        console.log("ERROR READING JSON FILE", path);
        callback(null, err);
        return;
      }
      var obj = JSON.parse(data);
      callback(obj);
    });
  }

  deleteAppRelativeDirectory(relativePath) {
    console.log("Delete App Relative Directory", relativePath);
    let deleteDirectory = (dir_path) => {
      if (fs.existsSync(dir_path)) {
        fs.readdirSync(dir_path).forEach((entry) => {
          var entry_path = path.join(dir_path, entry);
          if (fs.lstatSync(entry_path).isDirectory()) {
            deleteDirectory(entry_path);
          } else {
            fs.unlinkSync(entry_path);
          }
        });
        fs.rmdirSync(dir_path);
      }
    }

    deleteDirectory(path.join(appPath, relativePath));
  }

  ensureDirectoryExists(filePath) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    this.ensureDirectoryExists(dirname);
    fs.mkdirSync(dirname);
  }

  downloadFile(url, filePath, callback) {
    this.ensureDirectoryExists(filePath);

    // null callback after calliing because multiple '.on' could be called

    request(url)
      .on('error', function (err) {
        console.log('File download error', url,  err);
        callback && callback()
        callback = null;
      })
      .on('response', function(response) {
        if(response.statusCode !== 200) {
          console.log("File download not 200", url);
          callback && callback(response);
          callback = null;
        }
      })
      .pipe(fs.createWriteStream(filePath))
      .on('close', function() {
        console.log('File download success', url);
        callback && callback(null)
        callback = null;
      });
  }

  unzipFile(filePath, dest, callback) {
    console.log("Unzipping file at", filePath, "to", dest);
    fs.readFile(filePath, 'utf8', function (err, data) {
      if(err) {
         console.log("Unzip File Error", err);
         callback(err);
         return;
      }

      var zip = new AdmZip(filePath);
      zip.extractAllTo(dest, true /* overwrite */);
      // fs.unlink(filePath); delete original file
      callback();
    });
  }

  /*
    When downloading archives via GitHub, which will be a common use case, we want to be able to use the automatic "sourcecode.zip"
    file that GitHub generates with new releases. However, when you unzip those, it does not immediately reveal the source, but instead
    nests it in a folder. This function checks to see if the downloaded zip contains only 1 folder, and that folder contains a package.json, and if it does
    moves all that folders contents up by a level.
   */
  unnestPackageContents(directory, callback) {
    // console.log("unnestPackageContents", directory);
    fs.readdir(directory, (err, files) => {
      if(err) {
        callback();
        return;
      }

      if(files.length == 1) {
        var file = files[0];
        var location = path.join(directory, file);
        if(fs.statSync(location).isDirectory()) {
          // Unnest
          this.copyFolderRecursiveSync(location, directory, false);
          callback();
          return;
        }
      }

      callback();
    });
  }

  copyFileSync(source, target) {
    var targetFile = target;

    //if target is a directory a new file with the same name will be created
    if(fs.existsSync(target)) {
      if(fs.lstatSync(target).isDirectory()) {
        targetFile = path.join(target, path.basename(source));
      }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
  }

  copyFolderRecursiveSync(source, target, addBase) {
    // console.log("copyFolderRecursiveSync", source, target);
    var files = [];

    // Check if folder needs to be created or integrated
    var targetFolder = addBase ? path.join(target, path.basename(source)) : target;
    if(!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder);
    }

    // Copy
    if (fs.lstatSync(source).isDirectory()) {
      files = fs.readdirSync(source);
      files.forEach((file) => {
        var curSource = path.join(source, file);
        if(fs.lstatSync(curSource).isDirectory()) {
          this.copyFolderRecursiveSync(curSource, targetFolder, true);
        } else {
          this.copyFileSync(curSource, targetFolder);
        }
      });
    }
  }

}

export default new PackageManager();
