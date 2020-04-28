import anyTest, { ExecutionContext, TestInterface } from 'ava';
import { promises as fs } from 'fs';
import { writeJSONFile } from '../app/javascripts/main/fileUtils';
import { createDriver, Driver } from './driver';

const test = anyTest as TestInterface<Driver>;

async function validateData(t: ExecutionContext<Driver>) {
  const data = await t.context.updates.settings();
  t.true(typeof data.autoupdateEnabled === 'boolean');
  /** Must not throw */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _url = new URL(data.endpoint);
}

test.beforeEach(async (t) => {
  t.context = await createDriver();
});

test.afterEach.always(async (t) => {
  await t.context.stop();
});

test('has auto-updates enabled by default', async (t) => {
  const settings = await t.context.updates.settings();
  t.true(settings.autoupdateEnabled);
});

test('recovers its settings when the data is corrupted', async (t) => {
  const settingsFilePath = await t.context.updates.settingsLocation();
  await fs.writeFile(settingsFilePath, '0xFF'.repeat(300));
  await t.context.restart();
  await validateData(t);
});

test('fills in default values when some settings are missing', async (t) => {
  const settingsFilePath = await t.context.updates.settingsLocation();
  await writeJSONFile(settingsFilePath, {});
  await t.context.restart();
  await validateData(t);
});

test('reloads the menu after checking for an update', async (t) => {
  await t.context.updates.check();
  t.true(await t.context.updates.menuReloadTriggered());
});

test('updates its settings after checking for an update', async (t) => {
  const settings = await t.context.updates.settings();
  t.falsy(settings.lastCheck);
  await t.context.updates.check();
  const lastCheck = (await t.context.updates.settings()).lastCheck;
  t.truthy(lastCheck);
  const checkDate = new Date(lastCheck);
  t.false(Number.isNaN(checkDate.getTime()));
});
