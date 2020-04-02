import { strict as assert } from 'assert';
import { Suite } from 'mocha';
import { Application } from 'spectron';
import { CommandLineArgs } from '../app/javascripts/shared/CommandLineArgs';
import { launchApp, setDefaults } from './utils';
import fs from 'fs';
import { TestIpcMessages } from './TestIpcMessages';
import { serializeStoreData } from '../app/javascripts/main/store';

function getDataLocation(app: Application) {
  return app.electron.ipcRenderer.invoke(TestIpcMessages.StoreSettingsLocation);
}

async function readDataFromDisk(app: Application) {
  const location = await getDataLocation(app);
  return JSON.parse((await fs.promises.readFile(location)).toString());
}

async function validateData(app: Application) {
  const data = JSON.parse(
    await app.electron.ipcRenderer.invoke(TestIpcMessages.StoreData)
  );


  /**
   * There should always be 8 values in the store.
   * If one was added/removed intentionally, update this number
   */
  const numberOfStoreKeys = 8;
  assert.equal(Object.keys(data).length, numberOfStoreKeys);

  assert.equal(typeof data.isMenuBarVisible, 'boolean');

  assert.equal(typeof data.useSystemMenuBar, 'boolean');

  assert.equal(typeof data.backupsDisabled, 'boolean');

  assert.equal(typeof data.minimizeToTray, 'boolean');

  assert.equal(typeof data.zoomFactor, 'number');
  assert(data.zoomFactor > 0);

  assert.equal(typeof data.extServerHost, 'string');
  /** Must not throw */
  const extServerHost = new URL(data.extServerHost);
  assert.equal(extServerHost.hostname, '127.0.0.1');
  assert.equal(extServerHost.protocol, 'http:');
  assert.equal(extServerHost.port, '45653');

  assert.equal(typeof data.backupsLocation, 'string');
  const stat = fs.lstatSync(data.backupsLocation);
  assert(stat.isDirectory());

  assert(Array.isArray(data.selectedSpellCheckerLanguageCodes));
  for (const language of data.selectedSpellCheckerLanguageCodes) {
    assert.equal(typeof language, 'string');
  }
}

describe('Store', function(this: Suite) {
  setDefaults(this);

  let app: Application;

  before(async function() {
    app = await launchApp();
  });

  after(async function() {
    if (app.isRunning()) {
      await app.stop();
    }
  });

  it('has valid data', async function() {
    await validateData(app);
  });

  it('recreates a missing data file', async function() {
    const location = await getDataLocation(app);
    await app.stop();
    /** Delete the store's backing file */
    fs.unlinkSync(location);
    await app.start();
    await validateData(app);
  });

  it('recovers from corrupted data', async function() {
    const location = await getDataLocation(app);
    await app.stop();
    /** Write bad data in the store's file */
    fs.writeFileSync(location, '\uFFFF'.repeat(300));
    await app.start();
    await validateData(app);
  });

  it('persists changes to disk after setting a value', async function() {
    await app.electron.ipcRenderer.invoke(
      TestIpcMessages.StoreSet,
      'zoomFactor',
      4.8
    );
    const diskData = await readDataFromDisk(app);
    assert.equal(diskData.zoomFactor, 4.8);
  });

  it('serializes string sets to an array', async function() {
    assert.deepStrictEqual(
      serializeStoreData({
        set: new Set(['value'])
      } as any),
      JSON.stringify({
        set: ['value']
      })
    );
  });
});
