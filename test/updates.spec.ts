import { serial as anyTest, TestInterface } from 'ava';
import { createDriver, Driver } from './driver';

const test = anyTest as TestInterface<Driver>;

test.beforeEach(async (t) => {
  t.context = await createDriver();
});

test.afterEach.always(async (t) => {
  await t.context.stop();
});

test('has auto-updates enabled by default', async (t) => {
  t.true(await t.context.updates.autoUpdateEnabled());
});

test('reloads the menu after checking for an update', async (t) => {
  await t.context.updates.check();
  t.true(await t.context.appMenu.hasReloaded());
});

test.only('updates its settings after checking for an update', async (t) => {
  let state = await t.context.updates.state();
  t.falsy(state.lastCheck);
  await t.context.appStateCall('setBackupCreationDate', Date.now());
  await t.context.updates.check();
  state = await t.context.updates.state();
  t.truthy(state.lastCheck);
  const checkDate = new Date(state.lastCheck);
  t.false(Number.isNaN(checkDate.getTime()));
});
