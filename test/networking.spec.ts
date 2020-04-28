import test from 'ava';
import { promises as fs } from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import path from 'path';
import proxyquire from 'proxyquire';
import { createTmpDir } from './testUtils';

const tmpDir = createTmpDir(__filename);

const { getJSON, downloadFile } = proxyquire(
  '../app/javascripts/main/networking',
  {
    https: http,
  }
);

const sampleData = {
  title: 'Diamond Dove',
  meter: {
    4: 4,
  },
  instruments: ['Piano', 'Chiptune'],
};

let server: http.Server;
let serverAddress: string;

test.before(
  (): Promise<any> => {
    return Promise.all([
      tmpDir.make(),
      new Promise((resolve) => {
        server = http.createServer((_req, res) => {
          res.write(JSON.stringify(sampleData));
          res.end();
        });
        server.listen(0, '127.0.0.1', () => {
          const { address, port } = server.address() as AddressInfo;
          serverAddress = `http://${address}:${port}`;
          resolve();
        });
      }),
    ]);
  }
);

test.after(
  (): Promise<any> => {
    return Promise.all([
      tmpDir.clean(),
      new Promise((resolve) => server.close(resolve)),
    ]);
  }
);

test('downloads a JSON file', async (t) => {
  t.deepEqual(await getJSON(serverAddress), sampleData);
});

test('downloads a folder to the specified location', async (t) => {
  const filePath = path.join(tmpDir.path, 'fileName.json');
  await downloadFile(serverAddress + '/file', filePath);
  const fileContents = await fs.readFile(filePath, 'utf8');
  t.is(JSON.stringify(sampleData), fileContents);
});
