import compareVersions from 'compare-versions';
import { app, IpcMain } from 'electron';
import fs from 'fs';
import { debounce } from 'lodash';
import path from 'path';
import { IpcMessages } from '../shared/ipcMessages';
import {
  deleteDir,
  deleteDirContents,
  ensureDirectoryExists,
  extractNestedZip,
  FileDoesNotExist,
  readJSONFile,
  writeJSONFile,
} from './fileUtils';
import { downloadFile, getJSON } from './networking';
import { AppName } from './strings';

const tempPath = app.getPath('temp');
const appPath = app.getPath('userData');
const ExtensionsFolderName = 'Extensions';

function log(...message: any) {
  console.log('PackageManager:', ...message);
}

function logError(...message: any) {
  console.error('PackageManager:', ...message);
}

/* eslint-disable camelcase */
interface Component {
  uuid: string;
  deleted: boolean;
  content: {
    name: string;
    autoupdateDisabled: boolean;
    local_url?: string;
    package_info: {
      identifier: string;
      version: string;
      download_url: string;
      latest_url?: string;
    };
  };
}
/* eslint-enable camelcase */

export interface SyncTask {
  components: Component[];
}

interface ComponentLocation {
  location: string;
}

interface Mapping {
  get(componentId: string): ComponentLocation | undefined;
  set(componendId: string, location: string): void;
  remove(componendId: string): void;
}

/**
 * Safe component mapping manager that queues its disk writes
 */
async function createMapping() {
  interface MappingFile {
    [key: string]: {
      location: string;
    };
  }
  let mapping: MappingFile;

  const mappingFileLocation = path.join(
    appPath,
    ExtensionsFolderName,
    'mapping.json'
  );

  try {
    mapping = await readJSONFile<MappingFile>(mappingFileLocation);
  } catch (error) {
    /**
     * Mapping file might be absent (first start, corrupted data)
     */
    if (error.code === FileDoesNotExist) {
      await ensureDirectoryExists(path.dirname(mappingFileLocation));
    } else {
      logError(error);
    }
    mapping = {};
  }

  let writingToDisk = false;
  const writeToDisk = debounce(async () => {
    if (writingToDisk) return;
    writingToDisk = true;
    try {
      await writeJSONFile(mappingFileLocation, mapping);
    } catch (error) {
      logError(error);
    }
    writingToDisk = false;
  }, 100);

  return {
    get(componendId: string) {
      const component = mapping[componendId];
      if (component) {
        /** Do a shallow clone to protect against modifications */
        return {
          ...component,
        };
      }
    },
    set(componentId: string, location: string) {
      mapping[componentId] = {
        location,
      };
      writeToDisk();
    },
    remove(componentId: string) {
      delete mapping[componentId];
      writeToDisk();
    },
  };
}

export async function initializePackageManager(
  ipcMain: IpcMain,
  webContents: Electron.WebContents
): Promise<void> {
  const syncTasks: SyncTask[] = [];
  let isRunningTasks = false;

  const mapping = await createMapping();

  ipcMain.on(
    IpcMessages.SyncComponents,
    async (_event, data: { componentsData: Component[] }) => {
      const components = data.componentsData;

      log(
        'received sync event for:',
        components
          .map(
            ({ content, deleted }) =>
              `${content.name} (${content.package_info.version}) ` +
              `(deleted: ${deleted})`
          )
          .join(', ')
      );
      syncTasks.push({ components });

      if (isRunningTasks) return;
      isRunningTasks = true;
      await runTasks(webContents, mapping, syncTasks);
      isRunningTasks = false;
    }
  );
}

async function runTasks(
  webContents: Electron.WebContents,
  mapping: Mapping,
  tasks: SyncTask[]
) {
  while (tasks.length > 0) {
    try {
      const oppositeTask = await runTask(
        webContents,
        mapping,
        tasks[0],
        tasks.slice(1)
      );
      if (oppositeTask) {
        tasks.splice(tasks.indexOf(oppositeTask), 1);
      }
    } catch (error) {
      /** TODO(baptiste): do something */
      logError(error);
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
  mapping: Mapping,
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
        const oppositeTask = nextTasks.find((otherTask) => {
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
      await syncComponents(webContents, mapping, task.components);
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
  mapping: Mapping,
  components: Component[]
) {
  /**
   * Incoming `components` are what should be installed. For every component,
   * check the filesystem and see if that component is installed. If not,
   * install it.
   */
  await Promise.all(
    components.map(async (component) => {
      if (component.deleted) {
        /** Uninstall */
        log(`Uninstalling ${component.content.name}`);
        await uninstallComponent(mapping, component.uuid);
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
        await installComponent(webContents, mapping, component);
      } else {
        try {
          /** Will trigger an error if the directory does not exist. */
          await fs.promises.lstat(paths.absolutePath);
          if (!component.content.autoupdateDisabled) {
            await checkForUpdate(webContents, mapping, component);
          }
        } catch (error) {
          if (error.code === FileDoesNotExist) {
            /** We have a component but no content. Install the component */
            await installComponent(webContents, mapping, component);
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
  mapping: Mapping,
  component: Component
) {
  const downloadUrl = component.content.package_info.download_url;
  if (!downloadUrl) {
    log(
      'Tried to install a component with no download url:',
      component.content.name
    );
    return;
  }

  log('Installing ', component.content.name, downloadUrl);

  const sendInstalledMessage = (
    component: Component,
    error?: { message: string; tag: string }
  ) => {
    if (error) {
      logError(
        `Error when installing component ${component.content.name}: ` +
          error.message
      );
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
      })(),
    ]);

    log('Extracting', paths.downloadPath, 'to', paths.absolutePath);
    await extractNestedZip(paths.downloadPath, paths.absolutePath);

    const packagePath = path.join(paths.absolutePath, 'package.json');
    const response = await readJSONFile<{
      sn?: { main?: string };
      version?: string;
    }>(packagePath);

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
    mapping.set(component.uuid, paths.relativePath);

    sendInstalledMessage(component);
  } catch (error) {
    sendInstalledMessage(component, {
      message: error.message,
      tag: 'error-downloading',
    });
  }
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
      tempPath,
      AppName,
      'downloads',
      component.content.name + '.zip'
    ),
  };
}

async function uninstallComponent(mapping: Mapping, uuid: string) {
  const componentMapping = mapping.get(uuid);
  if (!componentMapping || !componentMapping.location) {
    /** No mapping for component */
    return;
  }
  await deleteDir(path.join(appPath, componentMapping.location));
  mapping.remove(uuid);
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
  const response = await readJSONFile<{ version: string }>(packagePath);
  return response.version;
}

interface Package {
  version: string;
  // eslint-disable-next-line camelcase
  download_url: string;
}

async function checkForUpdate(
  webContents: Electron.WebContents,
  mapping: Mapping,
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
    getInstalledVersionForComponent(component),
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
    await installComponent(webContents, mapping, component);
  }
}
