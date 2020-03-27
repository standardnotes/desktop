import compareVersions from 'compare-versions';
import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { IpcMessages } from '../shared/ipcMessages';
import {
  deleteDir,
  deleteDirContents,
  ensureDirectoryExists,
  extractNestedZip,
  FileDoesNotExist,
  readJSONFile,
  writeJSONFile
} from './fileUtils';
import { downloadFile, getJSON } from './networking';
const appPath = app.getPath('userData');

const ExtensionsFolderName = 'Extensions';

function log(...message: any) {
  console.log('PackageManager:', ...message);
}

interface Component {
  uuid: string;
  deleted: boolean;
  content: {
    name: string;
    autoupdateDisabled: boolean;
    local_url: string;
    package_info: {
      identifier: string;
      version: string;
      download_url: string;
      latest_url?: string;
    };
  };
}

interface SyncTask {
  components: Component[];
}

const MappingFileLocation = `${appPath}/${ExtensionsFolderName}/mapping.json`;
async function getMapping() {
  try {
    return await readJSONFile(MappingFileLocation);
  } catch (error) {
    if (error.code === FileDoesNotExist) {
      /**
       * Mapping file might be absent (first start, corrupted data)
       */
      return {};
    }
    throw error;
  }
}

export function initializePackageManager(webContents: Electron.WebContents) {
  const syncTasks: SyncTask[] = [];
  let isRunningTasks = false;

  ipcMain.on(
    IpcMessages.SyncComponents,
    async (_event, data: { componentsData: Component[] }) => {
      const components = data.componentsData;

      log('sync:', components.map(c => c.content.name).join(', '));
      syncTasks.push({ components });

      if (isRunningTasks) return;
      isRunningTasks = true;
      await runTasks(webContents, syncTasks);
      isRunningTasks = false;
    }
  );
}

async function runTasks(webContents: Electron.WebContents, tasks: SyncTask[]) {
  while (tasks.length > 0) {
    try {
      const oppositeTask = await runTask(webContents, tasks[0], tasks.slice(1));
      if (oppositeTask) {
        tasks.splice(tasks.indexOf(oppositeTask), 1);
      }
    } catch (error) {
      /** TODO(baptiste): do something */
      log(error);
    } finally {
      /** Remove the task from the queue. */
      tasks.splice(0, 1);
    }
  }
}

/**
 * @param nextTasks the tasks that follow this one. Useful to see if we
 * need to run it at all (for example in the case of a succession of
 * install/uninstall)
 * @returns If a task opposite to this one was found, returns that tas without
 * doing anything. Otherwise undefined.
 */
async function runTask(
  webContents: Electron.WebContents,
  task: SyncTask,
  nextTasks: SyncTask[]
): Promise<SyncTask | undefined> {
  const maxTries = 3;
  /** Try to execute the task with up to three tries. */
  for (let tries = 1; tries <= maxTries; tries++) {
    try {
      if (task.components.length === 1 && nextTasks.length > 0) {
        /**
         * This is a single-component task, AKA an installation or
         * deletion
         */
        const component = task.components[0];
        /**
         * See if there is a task opposite to this one, to avoid doing
         * unnecessary processing
         */
        const oppositeTask = nextTasks.find(otherTask => {
          if (otherTask.components.length > 1) {
            /** Only check single-component tasks. */
            return false;
          }
          const otherComponent = otherTask.components[0];
          return (
            component.uuid === otherComponent.uuid &&
            component.deleted !== otherComponent.deleted
          );
        });
        if (oppositeTask) {
          /** Found an opposite task. return it to the caller and do nothing */
          return oppositeTask;
        }
      }
      await syncComponents(webContents, task.components);
      /** Everything went well, leave the loop */
      return;
    } catch (error) {
      if (tries < maxTries) {
        continue;
      } else {
        throw error;
      }
    }
  }
}

async function syncComponents(
  webContents: Electron.WebContents,
  components: Component[]
) {
  /**
   * Incoming `components` are what should be installed. For every component,
   * check the filesystem and see if that component is installed. If not,
   * install it.
   */
  log(`Syncing components: ${components.length}`);
  await Promise.all(
    components.map(async component => {
      if (component.deleted) {
        /** Uninstall */
        log(`Uninstalling ${component.content.name}`);
        await uninstallComponent(component.uuid);
        return;
      }

      if (!component.content.package_info) {
        log('Package info is null, skipping');
        return;
      }

      const paths = pathsForComponent(component);
      if (!component.content.local_url) {
        /**
         * We have a component but it is not mapped to anything on the file system
         */
        await installComponent(webContents, component);
      } else {
        try {
          /** Will trigger an error if the directory does not exist. */
          await fs.promises.lstat(paths.absolutePath);
          if (!component.content.autoupdateDisabled) {
            await checkForUpdate(webContents, component);
          }
        } catch (error) {
          if (error.code === FileDoesNotExist) {
            /** We have a component but no content. Install the component */
            await installComponent(webContents, component);
          } else {
            throw error;
          }
        }
      }
    })
  );
}

async function installComponent(
  webContents: Electron.WebContents,
  component: Component
) {
  const downloadUrl = component.content.package_info.download_url;
  if (!downloadUrl) {
    return;
  }

  log('Installing ', component.content.name, downloadUrl);

  const sendInstalledMessage = (
    component: Component,
    error?: { message: string; tag: string }
  ) => {
    if (error) {
      console.error(
        `Error when installing component ${component.content.name}: ` +
          error.message
      );
      console.log(error);
    } else {
      log(`Installed component ${component.content.name}`);
    }
    webContents.send('install-component-complete', { component, error });
  };

  const paths = pathsForComponent(component);
  try {
    log(`Downloading from ${downloadUrl}`);
    /** Download the zip and clear the component's directory in parallel */
    await Promise.all([
      downloadFile(downloadUrl, paths.downloadPath),
      (async () => {
        /** Clear the component's directory before extracting the zip. */
        await ensureDirectoryExists(paths.absolutePath);
        await deleteDirContents(paths.absolutePath);
      })()
    ]);

    log('Extracting', paths.downloadPath, 'to', paths.absolutePath);
    await extractNestedZip(paths.downloadPath, paths.absolutePath);

    const packagePath = path.join(paths.absolutePath, 'package.json');
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
      main = 'index.html';
    }

    component.content.local_url = 'sn://' + paths.relativePath + '/' + main;

    /** Update the mapping file. */
    await updateComponentLocation(component.uuid, paths.relativePath);

    sendInstalledMessage(component);
  } catch (error) {
    sendInstalledMessage(component, {
      message: error.message,
      tag: 'error-downloading'
    });
  }
}

async function updateComponentLocation(componentId: string, location: string) {
  let componentMappings;
  try {
    componentMappings = await getMapping();
  } catch (error) {
    if (error.code === FileDoesNotExist) {
      componentMappings = {};
    } else {
      throw error;
    }
  }
  /** Update the component's location. */
  componentMappings[componentId] = {
    ...componentMappings[componentId],
    location
  };

  await writeJSONFile(MappingFileLocation, componentMappings);
}

function pathsForComponent(component: Component) {
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
      'downloads',
      component.content.name + '.zip'
    )
  };
}

async function uninstallComponent(uuid: string) {
  const mapping = await getMapping();
  const componentMapping = mapping[uuid];
  if (!componentMapping || !componentMapping.location) {
    /** No mapping for component */
    return;
  }

  await deleteDir(path.join(appPath, componentMapping.location));
  delete mapping[componentMapping.uuid];
  await writeJSONFile(MappingFileLocation, mapping);
}

async function getInstalledVersionForComponent(
  component: Component
): Promise<string> {
  /**
   * We check package.json version rather than
   * component.content.package_info.version because we want device specific
   * versions rather than a globally synced value
   */
  const paths = pathsForComponent(component);
  const packagePath = path.join(paths.absolutePath, 'package.json');
  const response = await readJSONFile(packagePath);
  return response.version;
}

interface Package {
  version: string;
  download_url: string;
}

async function checkForUpdate(
  webContents: Electron.WebContents,
  component: Component
) {
  const latestURL = component.content.package_info.latest_url;
  if (!latestURL) {
    console.warn(
      `No latest url, skipping update for ${component.content.name}`
    );
    return;
  }

  const [payload, installedVersion] = await Promise.all([
    getJSON<Package>(latestURL),
    getInstalledVersionForComponent(component)
  ]);
  log(
    `Checking for update for ${component.content.name}\n` +
      `Latest: ${payload.version} | Installed: ${installedVersion}`
  );
  if (compareVersions(payload.version, installedVersion) === 1) {
    /** Latest version is greater than installed version */
    log('Downloading new version', payload.download_url);
    component.content.package_info.download_url = payload.download_url;
    component.content.package_info.version = payload.version;
    await installComponent(webContents, component);
  }
}
