import { FileUtils } from "./fileUtils";
const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const request = require("request");
const appPath = app.getPath('userData');
const AdmZip = require('adm-zip');
const compareVersions = require('compare-versions');
const fileUtils = new FileUtils();

const ExtensionsFolderName = "Extensions";
const MappingFileLocation = appPath + `/${ExtensionsFolderName}/mapping.json`;

export class PackageManager {

  constructor(window) {
    this.window = window;
    ipcMain.on('install-component', (event, data) => {
      this.installComponent(data.componentData);
    });

    ipcMain.on('sync-components', (event, data) => {
      this.syncComponents(data.componentsData);
    });
  }

  pathsForComponent(component) {
    const relativePath = `${ExtensionsFolderName}/` + component.content.package_info.identifier;
    return {
      downloadPath: appPath + `/${ExtensionsFolderName}/downloads/` + component.content.name + ".zip",
      relativePath: relativePath,
      absolutePath: appPath + "/" + relativePath
    };
  }

  installComponent(component) {
    const downloadUrl = component.content.package_info.download_url;
    if (!downloadUrl) {
      return;
    }

    console.log("Installing component", component.content.name, downloadUrl);

    const callback = (installedComponent, error) => {
      this.window.webContents.send("install-component-complete", { component: installedComponent, error: error });
    };

    const paths = this.pathsForComponent(component);

    fileUtils.downloadFile(downloadUrl, paths.downloadPath, (error) => {
      if (!error) {
        // Delete any existing content, especially in the case of performing an update
        fileUtils.deleteAppRelativeDirectory(paths.relativePath);

        // Extract contents
        this.unzipFile(paths.downloadPath, paths.absolutePath, (err) => {
          if (!err) {
            this.unnestPackageContents(paths.absolutePath, () => {
              // Find out main file
              fileUtils.readJSONFile(paths.absolutePath + "/package.json", (response, error) => {
                var main;
                if (response) {
                  if (response.sn) { main = response.sn.main; }
                  if (response.version) { component.content.package_info.version = response.version; }
                }
                if (!main) { main = "index.html"; }

                component.content.local_url = "sn://" + paths.relativePath + "/" + main;
                callback(component);

                // Update mapping file
                this.updateMappingFile(component.uuid, paths.relativePath);
              });
            });
          } else {
            // Unzip error
            console.log("Unzip error for", component.content.name);
            callback(component, { tag: "error-unzipping" });
          }
        });
      } else {
        // Download error
        callback(component, { tag: "error-downloading" });
      }
    });
  }

  /*
    Maintains a JSON file which maps component ids to their installation location. This allows us to uninstall components
    when they are deleted and do not have any `content`. We only have their uuid to go by.
   */
  updateMappingFile(componentId, componentPath) {
    fileUtils.readJSONFile(MappingFileLocation, (response, error) => {
      if (!response) response = {};

      var obj = response[componentId] || {};
      obj.location = componentPath;
      response[componentId] = obj;

      fs.writeFile(MappingFileLocation, JSON.stringify(response, null, 2), 'utf8', (err) => {
        if (err) console.log("Mapping file save error:", err);
      });
    });
  }

  syncComponents(components) {
    // Incoming `components` are what should be installed. For every component, check
    // the filesystem and see if that component is installed. If not, install it.

    console.log(`Syncing components: ${components.length}`);

    for (const component of components) {
      if (component.deleted) {
        // Uninstall
        this.uninstallComponent(component);
        continue;
      }

      if (!component.content.package_info) {
        console.log("Package info is null, continuing");
        continue;
      }

      const paths = this.pathsForComponent(component);
      fs.stat(paths.absolutePath, (err, stats) => {
        var doesntExist = err && err.code === 'ENOENT';
        if (doesntExist || !component.content.local_url) {
          // Doesn't exist, install it
          this.installComponent(component);
        } else if (!component.content.autoupdateDisabled) {
          // Check for updates
          this.checkForUpdate(component);
        } else {
          // Already exists or update update disabled
          console.log("Not installing component", component.content.name, "Already exists?", !doesntExist);
        }
      });
    }
  }

  async checkForUpdate(component) {
    var latestURL = component.content.package_info.latest_url;
    if (!latestURL) {
      console.log("No latest url, skipping update", component.content.name);
      return;
    }

    request.get(latestURL, async (error, response, body) => {
      if (!error && response.statusCode === 200) {
        const payload = JSON.parse(body);
        const installedVersion = await this.getInstalledVersionForComponent(component);
        console.log("Checking for update for:", component.content.name,
          "Latest Version:", payload.version, "Installed Version", installedVersion);
        if (
          payload && payload.version
          && compareVersions(payload.version, installedVersion) === 1
        ) {
          // Latest version is greater than installed version
          console.log("Downloading new version", payload.download_url);
          component.content.package_info.download_url = payload.download_url;
          component.content.package_info.version = payload.version;
          this.installComponent(component);
        }
      }
    });
  }

  async getInstalledVersionForComponent(component) {
    // We check package.json version rather than component.content.package_info.version
    // because we want device specific versions rather than a globally synced value
    const paths = this.pathsForComponent(component);
    const packagePath = path.join(paths.absolutePath, "package.json");
    return new Promise((resolve, reject) => {
      fileUtils.readJSONFile(packagePath, (response, error) => {
        if (!response) {
          resolve(null);
        } else {
          resolve(response.version);
        }
      });
    });
  }

  uninstallComponent(component) {
    console.log("Uninstalling component", component.uuid);
    fileUtils.readJSONFile(MappingFileLocation, (response, error) => {
      if (!response) {
        // No mapping.json means nothing is installed
        return;
      }

      // Get installation location
      const mapping = response[component.uuid];
      if (!mapping || !mapping.location) {
        return;
      }

      const location = mapping.location;
      fileUtils.deleteAppRelativeDirectory(location);
      delete response[component.uuid];
      fs.writeFile(MappingFileLocation, JSON.stringify(response, null, 2), 'utf8', (err) => {
        if (err) console.log("Uninstall, mapping file save error:", err);
      });
    });
  }

  /*
    File/Network Operations
  */

  unzipFile(filePath, dest, callback) {
    console.log("Unzipping file at", filePath, "to", dest);
    fs.readFile(filePath, 'utf8', function (err, data) {
      if (err) {
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
      if (err) {
        callback();
        return;
      }

      if (files.length === 1) {
        var file = files[0];
        var location = path.join(directory, file);
        if (fs.statSync(location).isDirectory()) {
          // Unnest
          fileUtils.copyFolderRecursiveSync(location, directory, false);
          callback();
          return;
        }
      }

      callback();
    });
  }
}
