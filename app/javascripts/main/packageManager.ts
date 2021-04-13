import compareVersions from 'compare-versions';
import { IpcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { IpcMessages } from '../shared/ipcMessages';
import {
  debouncedJSONDiskWriter,
  deleteDir,
  deleteDirContents,
  ensureDirectoryExists,
  extractNestedZip,
  FileDoesNotExist,
  readJSONFile,
} from './fileUtils';
import { downloadFile, getJSON } from './networking';
import { Paths } from './paths';
import { AppName } from './strings';
import { timeout } from './utils';

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
  content?: {
    name?: string;
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

interface MappingFile {
  [key: string]: Readonly<ComponentMapping> | undefined;
}

interface ComponentMapping {
  location: string;
  version?: string;
}

/**
 * Safe component mapping manager that queues its disk writes
 */
class MappingFileHandler {
  static async create() {
    let mapping: MappingFile;

    try {
      mapping = await readJSONFile<MappingFile>(Paths.extensionsMappingJson);
    } catch (error) {
      /**
       * Mapping file might be absent (first start, corrupted data)
       */
      if (error.code === FileDoesNotExist) {
        await ensureDirectoryExists(path.dirname(Paths.extensionsMappingJson));
      } else {
        logError(error);
      }
      mapping = {};
    }

    return new MappingFileHandler(mapping);
  }

  constructor(private mapping: MappingFile) {}

  get = (componendId: string) => {
    return this.mapping[componendId];
  };

  set = (componentId: string, location: string, version: string) => {
    this.mapping[componentId] = {
      location,
      version,
    };
    this.writeToDisk();
  };

  remove = (componentId: string) => {
    delete this.mapping[componentId];
    this.writeToDisk();
  };

  getInstalledVersionForComponent = async (
    component: Component
  ): Promise<string> => {
    const version = this.get(component.uuid)?.version;
    if (version) {
      return version;
    }

    /**
     * If the mapping has no version (pre-3.5 installs) check the component's
     * package.json file
     */
    const paths = pathsForComponent(component);
    const packagePath = path.join(paths.absolutePath, 'package.json');
    const response = await readJSONFile<{ version: string }>(packagePath);
    this.set(component.uuid, paths.relativePath, response.version);
    return response.version;
  };

  private writeToDisk = debouncedJSONDiskWriter(
    100,
    Paths.extensionsMappingJson,
    () => this.mapping
  );
}

export async function initializePackageManager(
  ipcMain: IpcMain,
  webContents: Electron.WebContents
): Promise<void> {
  const syncTasks: SyncTask[] = [];
  let isRunningTasks = false;

  const mapping = await MappingFileHandler.create();

  ipcMain.on(
    IpcMessages.SyncComponents,
    async (_event, data: { componentsData: Component[] }) => {
      const components = data.componentsData;

      log(
        'received sync event for:',
        components
          .map(
            ({ content, deleted }) =>
              // eslint-disable-next-line camelcase
              `${content?.name} (${content?.package_info?.version}) ` +
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
  mapping: MappingFileHandler,
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
  mapping: MappingFileHandler,
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
  mapping: MappingFileHandler,
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
        log(`Uninstalling ${component.content?.name}`);
        await uninstallComponent(mapping, component.uuid);
        return;
      }

      // eslint-disable-next-line camelcase
      if (!component.content?.package_info) {
        log('Package info is null, skipping');
        return;
      }

      const paths = pathsForComponent(component);
      const version = component.content.package_info.version;
      if (!component.content.local_url) {
        /**
         * We have a component but it is not mapped to anything on the file system
         */
        await installComponent(webContents, mapping, component, version);
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
            await installComponent(webContents, mapping, component, version);
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
  mapping: MappingFileHandler,
  component: Component,
  version: string
) {
  if (!component.content) {
    return;
  }
  const downloadUrl = component.content.package_info.download_url;
  if (!downloadUrl) {
    return;
  }
  const name = component.content.name;

  log('Installing ', name, downloadUrl);

  const sendInstalledMessage = (
    component: Component,
    error?: { message: string; tag: string }
  ) => {
    if (error) {
      logError(`Error when installing component ${name}: ` + error.message);
    } else {
      log(`Installed component ${name} (${version})`);
    }
    webContents.send(IpcMessages.InstallComponentComplete, {
      component,
      error,
    });
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

    let main = 'index.html';
    try {
      /** Try to read 'sn.main' field from 'package.json' file */
      const packageJsonPath = path.join(paths.absolutePath, 'package.json');
      const packageJson = await readJSONFile<{
        sn?: { main?: string };
        version?: string;
      }>(packageJsonPath);

      if (packageJson?.sn?.main) {
        main = packageJson.sn.main;
      }
    } catch (error) {
      logError(error);
    }

    component.content.local_url = 'sn://' + paths.relativePath + '/' + main;
    mapping.set(component.uuid, paths.relativePath, version);

    sendInstalledMessage(component);
  } catch (error) {
    log(`Error while installing ${component.content.name}`, error.message);

    /**
     * Waiting five seconds prevents clients from spamming install requests
     * of faulty components
     */
    const fiveSeconds = 5000;
    await timeout(fiveSeconds);

    sendInstalledMessage(component, {
      message: error.message,
      tag: 'error-downloading',
    });
  }
}

function pathsForComponent(component: Pick<Component, 'content'>) {
  const relativePath = path.join(
    Paths.extensionsDirRelative,
    component.content!.package_info.identifier
  );
  return {
    relativePath,
    absolutePath: path.join(Paths.userDataDir, relativePath),
    downloadPath: path.join(
      Paths.tempDir,
      AppName,
      'downloads',
      component.content!.name + '.zip'
    ),
  };
}

async function uninstallComponent(mapping: MappingFileHandler, uuid: string) {
  const componentMapping = mapping.get(uuid);
  if (!componentMapping || !componentMapping.location) {
    /** No mapping for component */
    return;
  }
  await deleteDir(path.join(Paths.userDataDir, componentMapping.location));
  mapping.remove(uuid);
}

interface Package {
  version: string;
  // eslint-disable-next-line camelcase
  download_url: string;
}

async function checkForUpdate(
  webContents: Electron.WebContents,
  mapping: MappingFileHandler,
  component: Component
) {
  const latestURL = component.content!.package_info.latest_url;
  if (!latestURL) {
    console.warn(
      `No latest url, skipping update for ${component.content?.name}`
    );
    return;
  }

  const [payload, installedVersion] = await Promise.all([
    getJSON<Package>(latestURL),
    mapping.getInstalledVersionForComponent(component),
  ]);
  log(
    `Checking for update for ${component.content?.name}\n` +
      `Latest: ${payload.version} | Installed: ${installedVersion}`
  );
  if (compareVersions(payload.version, installedVersion) === 1) {
    /** Latest version is greater than installed version */
    log('Downloading new version', payload.download_url);
    component.content!.package_info.download_url = payload.download_url;
    component.content!.package_info.version = payload.version;
    await installComponent(webContents, mapping, component, payload.version);
  }
}
