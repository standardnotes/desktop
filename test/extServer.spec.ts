import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import http, { IncomingMessage } from 'http';
import 'mocha';
import path from 'path';
import proxyquire from 'proxyquire';
import { ensureDirectoryExists } from '../app/javascripts/main/fileUtils';
import { tools } from './tools';

let server: http.Server;

const { createExtensionsServer, normalizeFilePath } = proxyquire(
  '../app/javascripts/main/extServer',
  {
    electron: {
      app: {
        getPath() {
          return tools.tmpDir.path;
        },
      },
    },
    http: {
      createServer(...args: any) {
        server = http.createServer(...args);
        return server;
      },
    },
  }
);

const { getJSON, get } = proxyquire('../app/javascripts/main/networking', {
  https: http,
});

tools.strings.initialize();

describe('Extensions server', function () {
  const extensionsDir = path.join(tools.tmpDir.path, 'Extensions');

  let host: string;

  const log = console.log;
  const error = console.error;
  before(function () {
    /** Prevent the extensions server from outputting anything */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    console.log = () => {};
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    console.error = () => {};

    return Promise.all([
      ensureDirectoryExists(extensionsDir),
      new Promise((resolve) => {
        host = createExtensionsServer(resolve);
      }),
    ]);
  });

  after(function () {
    /** Restore the console's functions */
    console.log = log;
    console.error = error;

    return Promise.all([
      tools.tmpDir.remove(),
      new Promise((resolve) => server.close(resolve)),
    ]);
  });

  it('serves the files in the Extensions directory over HTTP', async function () {
    const data = {
      name: 'Boxes',
      meter: {
        4: 4,
      },
      syncopation: true,
      instruments: [
        'Drums',
        'Bass',
        'Vocals',
        { name: 'Piano', type: 'Electric' },
      ],
    };
    await fs.writeFile(
      path.join(extensionsDir, 'file.json'),
      JSON.stringify(data)
    );
    assert.deepEqual(await getJSON(host + 'Extensions/file.json'), data);
  });

  it('does not serve files outside the Extensions directory', async function () {
    const response: IncomingMessage = await get(
      host + 'Extensions/../../../package.json'
    );
    assert.equal(response.statusCode, 500);
  });

  it('returns a 404 for files that are not present', async function () {
    const response: IncomingMessage = await get(host + 'Extensions/nothing');
    assert.equal(response.statusCode, 404);
  });

  it('normalizes file paths to always point somewhere in the Extensions directory', function () {
    assert.equal(
      normalizeFilePath('/Extensions/test/yes', '127.0.0.1'),
      path.join(tools.tmpDir.path, 'Extensions', 'test', 'yes')
    );
    assert.equal(
      normalizeFilePath(
        '/Extensions/../../data/outside/the/extensions/directory'
      ),
      path.join(
        tools.tmpDir.path,
        'Extensions',
        'data',
        'outside',
        'the',
        'extensions',
        'directory'
      )
    );
  });
});
