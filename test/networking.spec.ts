import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import path from 'path';
import proxyquire from 'proxyquire';
import { tools } from './tools';

const { getJSON, downloadFile } = proxyquire(
  '../app/javascripts/main/networking',
  {
    https: http,
  }
);

describe('Networking utilities', function () {
  const sampleData = {
    title: 'Diamond Dove',
    meter: {
      4: 4,
    },
    instruments: ['Piano', 'Chiptune'],
  };
  let server: http.Server;
  let serverAddress: string;

  before(function () {
    return Promise.all([
      tools.tmpDir.make(),
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
  });
  after(function () {
    return Promise.all([
      tools.tmpDir.remove(),
      new Promise((resolve) => server.close(resolve)),
    ]);
  });

  it('downloads a JSON file', async function () {
    assert.deepEqual(await getJSON(serverAddress), sampleData);
  });

  it('downloads a folder to the specified location', async function () {
    const filePath = path.join(tools.tmpDir.path, 'fileName.json');
    await downloadFile(serverAddress + '/file', filePath);
    const fileContents = await fs.readFile(filePath, 'utf8');
    assert.equal(JSON.stringify(sampleData), fileContents);
  });
});
