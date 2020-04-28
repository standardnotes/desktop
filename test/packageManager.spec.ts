import test from 'ava';
import { IpcMainEvent } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import proxyquire from 'proxyquire';
import {
  ensureDirectoryExists,
  readJSONFile,
} from '../app/javascripts/main/fileUtils';
import { SyncTask } from '../app/javascripts/main/packageManager';
import { IpcMessages } from '../app/javascripts/shared/ipcMessages';
import { createTmpDir } from './testUtils';

const tmpDir = createTmpDir(__filename);

const contentDir = path.join(tmpDir.path, 'Extensions');
let downloadFileCallCount = 0;
const { initializePackageManager } = proxyquire(
  '../app/javascripts/main/packageManager',
  {
    electron: {
      app: {
        getPath() {
          return tmpDir.path;
        },
      },
    },
    './networking': {
      /** Download a fake component file */
      async downloadFile(_src: string, dest: string) {
        downloadFileCallCount += 1;
        if (!path.normalize(dest).startsWith(tmpDir.path)) {
          throw new Error(`Bad download destination: ${dest}`);
        }
        await ensureDirectoryExists(path.dirname(dest));
        await fs.copyFile(
          path.join(__dirname, 'data', 'zip-file.zip'),
          path.join(dest)
        );
      },
    },
  }
);

const fakeWebContents = {
  send(_eventName: string, { error }) {
    if (error) throw error;
  },
};

const fakeIpcMain = (() => {
  let handler: (event: IpcMainEvent, data: any) => Promise<void>;

  return {
    handler,
    on(message: IpcMessages, messageHandler: any) {
      if (message !== IpcMessages.SyncComponents) {
        throw new Error(`unknown message ${message}`);
      }
      if (handler) {
        throw new Error('handler already defined.');
      }
      handler = messageHandler;
    },
    async syncComponents(task: SyncTask) {
      await handler(undefined, {
        componentsData: task.components,
      });
      /** Give the package manager time to write to disk */
      await new Promise((resolve) => setTimeout(resolve, 200));
    },
  };
})();

const name = 'Fake Component';
const identifier = 'fake.component';
const uuid = 'fake-component';
const modifiers = Array(20)
  .fill(0)
  .map((_, i) => String(i).padStart(2, '0'));

function fakeComponent({ deleted = false, modifier = '' } = {}) {
  return {
    uuid: uuid + modifier,
    deleted,
    content: {
      name: name + modifier,
      autoupdateDisabled: false,
      package_info: {
        version: '0.0.1',
        identifier: identifier + modifier,
        download_url: 'https://standardnotes.org',
      },
    },
  };
}

const log = console.log;
const error = console.error;
test.before(async function () {
  /** Silence the package manager's output. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  console.log = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  console.error = () => {};
  await ensureDirectoryExists(contentDir);
  await initializePackageManager(fakeIpcMain, fakeWebContents);
});
test.after.always(async function () {
  console.log = log;
  console.error = error;
  await tmpDir.clean();
});

test.beforeEach(function () {
  downloadFileCallCount = 0;
});

test.serial('installs multiple components', async (t) => {
  await fakeIpcMain.syncComponents({
    components: modifiers.map((modifier) => fakeComponent({ modifier })),
  });
  await new Promise((resolve) => setTimeout(resolve, 200));

  const files = await fs.readdir(contentDir);
  t.is(files.length, 2 + modifiers.length);
  t.true(files.includes('downloads'));
  for (const modifier of modifiers) {
    t.true(files.includes(identifier + modifier));
  }
  t.true(files.includes('mapping.json'));
  const mappingContents = await fs.readFile(
    path.join(contentDir, 'mapping.json'),
    'utf8'
  );
  try {
    JSON.parse(mappingContents);
  } catch (e) {
    console.info(mappingContents);
  }
  t.deepEqual(
    JSON.parse(mappingContents),
    modifiers.reduce((acc, modifier) => {
      acc[uuid + modifier] = {
        location: path.join('Extensions', identifier + modifier),
      };
      return acc;
    }, {})
  );

  const downloads = await fs.readdir(path.join(contentDir, 'downloads'));
  t.is(downloads.length, modifiers.length);
  for (const modifier of modifiers) {
    t.true(downloads.includes(`${name + modifier}.zip`));
  }

  for (const modifier of modifiers) {
    const componentFiles = await fs.readdir(
      path.join(contentDir, identifier + modifier)
    );
    t.is(componentFiles.length, 2);
  }
});

test.serial('uninstalls multiple components', async (t) => {
  await fakeIpcMain.syncComponents({
    components: modifiers.map((modifier) =>
      fakeComponent({ deleted: true, modifier })
    ),
  });
  await new Promise((resolve) => setTimeout(resolve, 200));

  const files = await fs.readdir(contentDir);
  t.is(files.length, 2);
  t.true(files.includes('downloads'));
  t.true(files.includes('mapping.json'));

  t.deepEqual(await readJSONFile(path.join(contentDir, 'mapping.json')), {});
});

test.serial(
  "doesn't download anything when two install/uninstall tasks are queued",
  async (t) => {
    await Promise.all([
      fakeIpcMain.syncComponents({
        components: [fakeComponent({ deleted: false })],
      }),
      fakeIpcMain.syncComponents({
        components: [fakeComponent({ deleted: false })],
      }),
      fakeIpcMain.syncComponents({
        components: [fakeComponent({ deleted: true })],
      }),
    ]);
    t.is(downloadFileCallCount, 1);
  }
);
