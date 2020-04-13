import { strict as assert } from 'assert';
import fs from 'fs';
import { Suite } from 'mocha';
import { serializeStoreData } from '../app/javascripts/main/store';
import { setDefaults, tools } from './tools';

async function validateData() {
  const data = await tools.store.diskData();

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

  assert(Array.isArray(data.selectedSpellCheckerLanguageCodes));
  for (const language of data.selectedSpellCheckerLanguageCodes) {
    assert.equal(typeof language, 'string');
  }
}

describe('Store', function (this: Suite) {
  setDefaults(this);
  before(tools.launchApp);
  after(tools.stopApp);

  it('has valid data', async function () {
    await validateData();
  });

  it('recreates a missing data file', async function () {
    const location = await tools.store.diskLocation();
    await tools.app.stop();
    /** Delete the store's backing file */
    fs.unlinkSync(location);
    await tools.app.start();
    await validateData();
  });

  it('recovers from corrupted data', async function () {
    const location = await tools.store.diskLocation();
    await tools.app.stop();
    /** Write bad data in the store's file */
    fs.writeFileSync(location, '\uFFFF'.repeat(300));
    await tools.app.start();
    await validateData();
  });

  it('persists changes to disk after setting a value', async function () {
    const factor = 4.8;
    await tools.setZoomFactor(factor);
    const diskData = await tools.store.diskData();
    assert.equal(diskData.zoomFactor, factor);
  });

  it('serializes string sets to an array', async function () {
    assert.deepStrictEqual(
      serializeStoreData({
        set: new Set(['value']),
      } as any),
      JSON.stringify({
        set: ['value'],
      })
    );
  });
});
