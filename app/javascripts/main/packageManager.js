import {
  readJSONFile,
  deleteDir,
  writeJSONFile,
  FILE_DOES_NOT_EXIST,
  ensureDirectoryExists,
  extractNestedZip,
  deleteDirContents
} from "./fileUtils";
import { downloadFile, getJSON } from "./networking";
import { SYNC_COMPONENTS } from "../shared/messages";
const { ipcMain, app } = require("electron");
const fs = require("fs");
const path = require("path");
const appPath = app.getPath("userData");
const compareVersions = require("compare-versions");

const ExtensionsFolderName = "Extensions";
const MappingFileLocation = `${appPath}/${ExtensionsFolderName}/mapping.json`;

export function initializePackageManager(webContents) {
  const syncTasks = [];
  let isRunningTasks = false;

  ipcMain.on(SYNC_COMPONENTS, async (_event, data) => {
    console.log("Package manager: received event", SYNC_COMPONENTS);
    syncTasks.push(data.componentsData);
    if (isRunningTasks) return;
    isRunningTasks = true;
    await runTasks(webContents, syncTasks);
    isRunningTasks = false;
  });
}

function findOppositeTask(tasks, { uuid, deleted }) {
  return tasks.find(([t]) => t.uuid === uuid && t.deleted !== deleted);
}

async function runTasks(webContents, syncTasks) {
  const tries = 3;
  while (syncTasks.length > 0) {
    try {
      // Try to execute the task with up to three tries.
      for (let triesAmount = 1; triesAmount <= 3; triesAmount++) {
        try {
          const taskData = syncTasks[0];
          if (taskData.length === 1 && syncTasks.length > 1) {
            // This is a single task, AKA an installation or deletion.
            const oppositeTask = findOppositeTask(
              syncTasks.slice(1),
              taskData[0]
            );
            if (oppositeTask) {
              // Found an opposite task. Delete it from the queue and do nothing.
              syncTasks.splice(syncTasks.indexOf(oppositeTask), 1);
              break;
            }
          }
          await syncComponents(webContents, taskData);
          break; // Everything went well, leave the loop.
        } catch (error) {
          if (triesAmount < tries) {
            continue;
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      // TODO(baptiste): do something
    } finally {
      // Remove the task from the queue.
      syncTasks.splice(0, 1);
    }
  }
}

async function syncComponents(webContents, components) {
  // Incoming `components` are what should be installed. For every component, check
  // the filesystem and see if that component is installed. If not, install it.

  console.log(`Syncing components: ${components.length}`);

  for (const component of components) {
    if (component.deleted) {
      // Uninstall
      console.log(`Uninstalling ${component.content.name}`);
      await uninstallComponent(component.uuid);
      continue;
    }

    if (!component.content.package_info) {
      console.log("Package info is null, continuing");
      continue;
    }

    const paths = pathsForComponent(component);
    if (!component.content.local_url) {
      // We have a component but it is not mapped to anything on the
      // file system
      await installComponent(webContents, component);
    } else {
      try {
        // Will trigger an error if the directory does not exist.
        await fs.promises.lstat(paths.absolutePath);
        if (!component.content.autoupdateDisabled) {
          await checkForUpdate(webContents, component);
        }
      } catch (error) {
        if (error.code === FILE_DOES_NOT_EXIST) {
          // We have a component but no content. Install the component
          await installComponent(webContents, component);
        } else {
          throw error;
        }
      }
    }
  }
}

async function installComponent(webContents, component) {
  const downloadUrl = component.content.package_info.download_url;
  if (!downloadUrl) {
    return;
  }

  console.log("Installing ", component.content.name, downloadUrl);

  const sendInstalledMessage = (component, error) => {
    if (error) {
      console.error(
        `Error when installing component ${component.content.name}: ${error.message}`
      );
    } else {
      console.log(`Installed component ${component.content.name}`);
    }
    webContents.send("install-component-complete", { component, error });
  };

  const paths = pathsForComponent(component);
  try {
    console.log(`Downloading from ${downloadUrl}`);
    // Download the zip and clear the component's directory in parallel
    await Promise.all([
      downloadFile(downloadUrl, paths.downloadPath),
      (async () => {
        // Clear the component's directory before extracting the zip.
        await ensureDirectoryExists(paths.absolutePath);
        await deleteDirContents(paths.absolutePath);
      })()
    ]);

    console.log("Extracting", paths.downloadPath, "to", paths.absolutePath);
    await extractNestedZip(paths.downloadPath, paths.absolutePath);

    const packagePath = path.join(paths.absolutePath, "package.json");
    const response = await readJSONFile(packagePath);
    let main;
    if (response.sn) {
      main = response.sn.main;
    }
    if (response.version) {
      component.content.package_info.version = response.version;
    }
    if (!main) {
      console.warn(`No 'main' field in component package: ${packagePath}`);
      main = "index.html";
    }

    component.content.local_url = "sn://" + paths.relativePath + "/" + main;

    // Update the mapping file.
    await updateComponentLocation(component.uuid, paths.relativePath);

    sendInstalledMessage(component);
  } catch (error) {
    sendInstalledMessage(component, { tag: "error-downloading" });
  }
}

async function updateComponentLocation(componentId, location) {
  let componentMappings;
  try {
    componentMappings = await readJSONFile(MappingFileLocation);
  } catch (error) {
    if (error.code === FILE_DOES_NOT_EXIST) {
      componentMappings = {};
    } else {
      throw error;
    }
  }
  // Update the component's location.
  componentMappings[componentId] = {
    ...componentMappings[componentId],
    location
  };

  await writeJSONFile(MappingFileLocation, componentMappings);
}

function pathsForComponent(component) {
  const relativePath = path.join(
    ExtensionsFolderName,
    component.content.package_info.identifier
  );
  return {
    relativePath,
    absolutePath: path.join(appPath, relativePath),
    downloadPath: path.join(
      appPath,
      ExtensionsFolderName,
      "downloads",
      component.content.name + ".zip"
    )
  };
}

async function uninstallComponent(uuid) {
  const mapping = await readJSONFile(MappingFileLocation);
  const componentMapping = mapping[uuid];
  if (!componentMapping || !componentMapping.location) {
    // No mapping for component
    return;
  }

  await deleteDir(path.join(appPath, componentMapping.location));
  delete mapping[componentMapping.uuid];
  await writeJSONFile(MappingFileLocation, mapping);
}

async function getInstalledVersionForComponent(component) {
  // We check package.json version rather than component.content.package_info.version
  // because we want device specific versions rather than a globally synced value
  const paths = pathsForComponent(component);
  const packagePath = path.join(paths.absolutePath, "package.json");
  const response = await readJSONFile(packagePath);
  return response.version;
}

async function checkForUpdate(webContents, component) {
  const latestURL = component.content.package_info.latest_url;
  if (!latestURL) {
    console.warn(
      `No latest url, skipping update for ${component.content.name}`
    );
    return;
  }

  console.log(`Checking for update for ${component.content.name}`);
  const [payload, installedVersion] = await Promise.all([
    getJSON(latestURL),
    getInstalledVersionForComponent(component)
  ]);

  // prettier-ignore
  console.log(
    `\tLatest:    ${payload.version}` +
    `\n\tInstalled: ${installedVersion}`
  );
  if (compareVersions(payload.version, installedVersion) === 1) {
    // Latest version is greater than installed version
    console.log("Downloading new version", payload.download_url);
    component.content.package_info.download_url = payload.download_url;
    component.content.package_info.version = payload.version;
    await installComponent(webContents, component);
  }
}
