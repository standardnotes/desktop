import anyTest, { TestInterface } from 'ava';
import { promises as fs } from 'fs';
import http, { IncomingMessage } from 'http';
import path from 'path';
import proxyquire from 'proxyquire';
import { ensureDirectoryExists } from '../app/javascripts/main/fileUtils';
import { initializeStrings } from '../app/javascripts/main/strings';
import { AddressInfo } from 'net';
import { createTmpDir } from './testUtils';

const test = anyTest as TestInterface<{
  server: http.Server;
  host: string;
}>;

const tmpDir = createTmpDir(__filename);

let server: http.Server;

const { createExtensionsServer, normalizeFilePath } = proxyquire(
  '../app/javascripts/main/extServer',
  {
    electron: {
      app: {
        getPath() {
          return tmpDir.path;
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

const extensionsDir = path.join(tmpDir.path, 'Extensions');

initializeStrings('en');

const log = console.log;
const error = console.error;

test.before(
  (t): Promise<any> => {
    /** Prevent the extensions server from outputting anything */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    console.log = () => {};
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    console.error = () => {};

    return Promise.all([
      ensureDirectoryExists(extensionsDir),
      new Promise((resolve) => {
        createExtensionsServer(resolve);
        t.context.server = server;
        server.once('listening', () => {
          const { address, port } = server.address() as AddressInfo;
          t.context.host = `http://${address}:${port}/`;
          resolve();
        });
      }),
    ]);
  }
);

test.after(
  (t): Promise<any> => {
    /** Restore the console's functionality */
    console.log = log;
    console.error = error;

    return Promise.all([
      tmpDir.clean(),
      new Promise((resolve) => t.context.server.close(resolve)),
    ]);
  }
);

test('serves the files in the Extensions directory over HTTP', async (t) => {
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
  t.deepEqual(await getJSON(t.context.host + 'Extensions/file.json'), data);
});

test('does not serve files outside the Extensions directory', async (t) => {
  const response: IncomingMessage = await get(
    t.context.host + 'Extensions/../../../package.json'
  );
  t.is(response.statusCode, 500);
});

test('returns a 404 for files that are not present', async (t) => {
  const response: IncomingMessage = await get(
    t.context.host + 'Extensions/nothing'
  );
  t.is(response.statusCode, 404);
});

test('normalizes file paths to always point somewhere in the Extensions directory', (t) => {
  t.is(
    normalizeFilePath('/Extensions/test/yes', '127.0.0.1'),
    path.join(tmpDir.path, 'Extensions', 'test', 'yes')
  );
  t.is(
    normalizeFilePath(
      '/Extensions/../../data/outside/the/extensions/directory'
    ),
    path.join(
      tmpDir.path,
      'Extensions',
      'data',
      'outside',
      'the',
      'extensions',
      'directory'
    )
  );
});
