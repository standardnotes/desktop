import { promises as fs } from 'fs';
import path from 'path';
import anyTest, { TestInterface } from 'ava';
import { Driver, createDriver } from './driver';
import { BackupsDirectoryName } from '../app/javascripts/main/archiveManager';
import { StoreKeys } from '../app/javascripts/main/store';
import { FileDoesNotExist } from '../app/javascripts/main/fileUtils';

const test = anyTest as TestInterface<Driver>;

test.beforeEach(async (t) => {
  t.context = await createDriver();
});
test.afterEach(async (t) => {
  await t.context.stop();
});

test('saves incoming data to the backups folder', async (t) => {
  const data = 'Sample Data';
  const fileName = await t.context.backups.save(data);
  const backupsLocation = await t.context.backups.location();
  const files = await fs.readdir(backupsLocation);
  t.true(files.includes(fileName));
  t.is(data, await fs.readFile(path.join(backupsLocation, fileName), 'utf8'));
});

test('performs a backup', async (t) => {
  await t.context.backups.perform();
  const backupsLocation = await t.context.backups.location();
  const files = await fs.readdir(backupsLocation);
  t.true(files.length >= 1);
});

test('changes backups folder location', async (t) => {
  await t.context.backups.perform();
  let newLocation = path.join(t.context.userDataPath, 'newLocation');
  await fs.mkdir(newLocation);
  const currentLocation = await t.context.backups.location();
  const fileNames = await fs.readdir(currentLocation);
  await t.context.backups.changeLocation(newLocation);
  newLocation = path.join(newLocation, BackupsDirectoryName);
  t.deepEqual(fileNames, await fs.readdir(newLocation));

  /** Assert that the setting was saved */
  const data = await t.context.store.dataOnDisk();
  t.is(data[StoreKeys.BackupsLocation], newLocation);

  /** Perform backup and make sure there is one more file in the directory */
  await t.context.backups.perform();
  const newFileNames = await fs.readdir(newLocation);
  t.deepEqual(newFileNames.length, fileNames.length + 1);
});

test('backups are enabled by default', async (t) => {
  t.is(await t.context.backups.enabled(), true);
});

test('does not save a backup when they are disabled', async (t) => {
  await t.context.backups.toggleEnabled();
  await t.context.windowLoaded;
  /** Do not wait on this one as the backup shouldn't be triggered */
  t.context.backups.perform();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const backupsLocation = await t.context.backups.location();
  try {
    await fs.readdir(backupsLocation);
    t.fail(
      `A backups folder is present when backups have been disabled right
      after the app started.`
    );
  } catch (error) {
    t.is(error.code, FileDoesNotExist);
  }
});
