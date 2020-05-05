import anyTest, { TestInterface } from 'ava';
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
  t.true(await t.context.updates.notifiedStateChange());
});

test('updates its settings after checking for an update', async (t) => {
  const state = await t.context.updates.state();
  t.falsy(state.lastCheck);
  await t.context.updates.check();
  const lastCheck = (await t.context.updates.state()).lastCheck;
  t.truthy(lastCheck);
  const checkDate = new Date(lastCheck);
  t.false(Number.isNaN(checkDate.getTime()));
});
