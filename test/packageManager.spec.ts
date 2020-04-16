import test from 'ava';
import { promises as fs } from 'fs';
import path from 'path';
import proxyquire from 'proxyquire';
import {
  ensureDirectoryExists,
  readJSONFile,
} from '../app/javascripts/main/fileUtils';
import { SyncTask } from '../app/javascripts/main/packageManager';
import { createTmpDir } from './testUtils';

const tmpDir = createTmpDir(__filename);

const contentDir = path.join(tmpDir.path, 'Extensions');
let downloadFileCallCount = 0;
const { runTasks } = proxyquire('../app/javascripts/main/packageManager', {
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
});

const name = 'Fake Component';
const identifier = 'fake.component';
const uuid = 'fake-component';
const modifiers = ['a', 'b', 'c', 'd'];

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

function launchRunTasks(tasks: SyncTask[]) {
  return new Promise((resolve, reject) => {
    runTasks(
      {
        send(_e: string, { error }) {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        },
      },
      tasks
    ).catch(reject);
  });
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
});
test.after.always(async function () {
  console.log = log;
  console.error = error;
  await tmpDir.clean();
});

test.afterEach(function () {
  downloadFileCallCount = 0;
});

test.serial('installs multiple components', async (t) => {
  await launchRunTasks([
    { components: modifiers.map((modifier) => fakeComponent({ modifier })) },
  ]);

  const files = await fs.readdir(contentDir);
  t.is(files.length, 2 + modifiers.length);
  t.true(files.includes('downloads'));
  for (const modifier of modifiers) {
    t.true(files.includes(identifier + modifier));
  }
  t.true(files.includes('mapping.json'));
  t.deepEqual(
    await readJSONFile(path.join(contentDir, 'mapping.json')),
    modifiers.reduce((acc, modifier) => {
      acc[uuid + modifier] = {
        location: path.join('Extensions', identifier + modifier),
      };
      return acc;
    }, {})
  );
  t.deepEqual(
    await fs.readdir(path.join(contentDir, 'downloads')),
    modifiers.map((modifier) => `${name + modifier}.zip`)
  );

  for (const modifier of modifiers) {
    const componentFiles = await fs.readdir(
      path.join(contentDir, identifier + modifier)
    );
    t.is(componentFiles.length, 2);
  }
});

test.serial('uninstalls multiple components', async (t) => {
  await runTasks(undefined /** Webcontents aren't used during uninstall */, [
    {
      components: modifiers.map((modifier) =>
        fakeComponent({ deleted: true, modifier })
      ),
    },
  ]);

  const files = await fs.readdir(contentDir);
  t.is(files.length, 2);
  t.true(files.includes('downloads'));
  t.true(files.includes('mapping.json'));

  t.deepEqual(await readJSONFile(path.join(contentDir, 'mapping.json')), {});
});

test.serial(
  "doesn't download anything when two install/uninstall tasks are queued",
  async (t) => {
    await runTasks(undefined, [
      {
        components: [fakeComponent({ deleted: false })],
      },
      {
        components: [fakeComponent({ deleted: true })],
      },
    ]);
    t.is(downloadFileCallCount, 0);
  }
);
