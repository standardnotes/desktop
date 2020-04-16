import anyTest, { TestInterface } from 'ava';
import { createDriver, Driver } from './driver';

const test = anyTest as TestInterface<Driver>;

test.before(async (t) => {
  t.context = await createDriver();
});
test.after.always((t) => {
  return t.context.stop();
});

test('Only has one window', async (t) => {
  t.is(await t.context.windowCount(), 1);
});
