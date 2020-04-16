import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import 'mocha';
import { writeJSONFile } from '../app/javascripts/main/fileUtils';
import { setDefaults, tools } from './tools';

async function validateData() {
  const data = await tools.updates.settings();
  assert(typeof data.autoupdateEnabled === 'boolean');
  /** Must not throw */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _url = new URL(data.endpoint);
}

describe('Update manager', function () {
  setDefaults(this);
  beforeEach(tools.launchApp);
  afterEach(tools.stopApp);

  it('has auto-updates enabled by default', async function () {
    const settings = await tools.updates.settings();
    assert.equal(settings.autoupdateEnabled, true);
  });

  it('recovers its settings when the data is corrupted', async function () {
    const settingsFilePath = await tools.paths.updates();
    await fs.writeFile(settingsFilePath, '0xFF'.repeat(300));
    await tools.app.restart();
    await validateData();
  });

  it('fills in default values when some settings are missing', async function () {
    const settingsFilePath = await tools.paths.updates();
    await writeJSONFile(settingsFilePath, {});
    await tools.app.restart();
    await validateData();
  });

  it('reloads the menu after checking for an update', async function () {
    await tools.updates.check();
    assert(await tools.updates.menuReloadTriggered());
  });

  it('updates its settings after checking for an update', async function () {
    const settings = await tools.updates.settings();
    const previousCheckDate = new Date(settings.lastCheck);
    await tools.updates.check();
    const checkDate = new Date((await tools.updates.settings()).lastCheck);
    assert(previousCheckDate.getTime() < checkDate.getTime());
  });
});
