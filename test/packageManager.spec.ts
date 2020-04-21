import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import 'mocha';
import path from 'path';
import proxyquire from 'proxyquire';
import {
  ensureDirectoryExists,
  readJSONFile,
} from '../app/javascripts/main/fileUtils';
import { SyncTask } from '../app/javascripts/main/packageManager';
import { tools } from './tools';

const contentDir = path.join(tools.tmpDir.path, 'Extensions');
let downloadFileCallCount = 0;
const { runTasks } = proxyquire('../app/javascripts/main/packageManager', {
  electron: {
    app: {
      getPath() {
        return tools.tmpDir.path;
      },
    },
  },
  './networking': {
    /** Download a fake component file */
    async downloadFile(_src: string, dest: string) {
      downloadFileCallCount += 1;
      if (!path.normalize(dest).startsWith(tools.tmpDir.path)) {
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

describe('Package manager', function () {
  const log = console.log;
  const error = console.error;
  before(async function () {
    /** Silence the package manager's output. */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    console.log = () => {};
    console.error = () => {};
    await ensureDirectoryExists(contentDir);
  });
  after(async function () {
    console.log = log;
    console.error = error;
    await tools.tmpDir.remove();
  });

  afterEach(function () {
    downloadFileCallCount = 0;
  });

  it('installs multiple components', async function () {
    await launchRunTasks([
      { components: modifiers.map((modifier) => fakeComponent({ modifier })) },
    ]);

    const files = await fs.readdir(contentDir);
    assert.equal(files.length, 2 + modifiers.length);
    assert(files.includes('downloads'));
    for (const modifier of modifiers) {
      assert(files.includes(identifier + modifier));
    }
    assert(files.includes('mapping.json'));
    assert.deepEqual(
      await readJSONFile(path.join(contentDir, 'mapping.json')),
      modifiers.reduce((acc, modifier) => {
        acc[uuid + modifier] = {
          location: path.join('Extensions', identifier + modifier),
        };
        return acc;
      }, {})
    );
    assert.deepEqual(
      await fs.readdir(path.join(contentDir, 'downloads')),
      modifiers.map((modifier) => `${name + modifier}.zip`)
    );

    for (const modifier of modifiers) {
      const componentFiles = await fs.readdir(
        path.join(contentDir, identifier + modifier)
      );
      assert.equal(componentFiles.length, 2);
    }
  });

  it('uninstalls multiple components', async function () {
    await runTasks(undefined /** Webcontents aren't used during uninstall */, [
      {
        components: modifiers.map((modifier) =>
          fakeComponent({ deleted: true, modifier })
        ),
      },
    ]);

    const files = await fs.readdir(contentDir);
    assert.equal(files.length, 2);
    assert(files.includes('downloads'));
    assert(files.includes('mapping.json'));

    assert.deepEqual(
      await readJSONFile(path.join(contentDir, 'mapping.json')),
      {}
    );
  });

  it("doesn't download anything when two install/uninstall tasks are queued", async function () {
    await runTasks(undefined, [
      {
        components: [fakeComponent({ deleted: false })],
      },
      {
        components: [fakeComponent({ deleted: true })],
      },
    ]);
    assert.equal(downloadFileCallCount, 0);
  });
});
