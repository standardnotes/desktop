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

function fakeComponent({ deleted = false } = {}) {
  return {
    uuid,
    deleted,
    content: {
      name,
      autoupdateDisabled: false,
      package_info: {
        version: '0.0.1',
        identifier,
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
  before(async function () {
    /** Silence the package manager's output. */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    console.log = () => {};
    await ensureDirectoryExists(contentDir);
  });
  after(async function () {
    console.log = log;
    await tools.tmpDir.remove();
  });

  afterEach(function () {
    downloadFileCallCount = 0;
  });

  it('installs a component', async function () {
    await launchRunTasks([{ components: [fakeComponent()] }]);

    const files = await fs.readdir(contentDir);
    assert.equal(files.length, 3);
    assert(files.includes('downloads'));
    assert(files.includes(identifier));
    assert(files.includes('mapping.json'));
    assert.deepEqual(
      await readJSONFile(path.join(contentDir, 'mapping.json')),
      {
        [uuid]: {
          location: path.join('Extensions', identifier),
        },
      }
    );
    assert.deepEqual(await fs.readdir(path.join(contentDir, 'downloads')), [
      `${name}.zip`,
    ]);

    const componentFiles = await fs.readdir(path.join(contentDir, identifier));
    assert.equal(componentFiles.length, 2);
  });

  it('uninstalls a component', async function () {
    await runTasks(undefined /** Webcontents aren't used during uninstall */, [
      { components: [fakeComponent({ deleted: true })] },
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

  it('doesn\'t download anything when two install/uninstall tasks are queued', async function () {
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
