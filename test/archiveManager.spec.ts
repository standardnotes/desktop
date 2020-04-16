import 'mocha';
import { setDefaults, tools, timeout } from './tools';
import { promises as fs } from 'fs';
import { strict as assert } from 'assert';
import path from 'path';
import { StoreKeys } from '../app/javascripts/main/store';
import { FileDoesNotExist } from '../app/javascripts/main/fileUtils';
import { BackupsDirectoryName } from '../app/javascripts/main/archiveManager';

const BackupDuration = 1000;
describe('Archive Manager', function () {
  setDefaults(this);

  beforeEach(tools.launchApp);
  afterEach(tools.stopApp);

  it('saves incoming data to the backups folder', async function () {
    const data = 'Sample Data';
    tools.backups.save(data);
    const backupsLocation = await tools.backups.location();
    const files = await fs.readdir(backupsLocation);
    assert(files.length >= 1);
    const latestFile = files[files.length - 1];
    assert.equal(
      data,
      await fs.readFile(path.join(backupsLocation, latestFile), 'utf8')
    );
  });
  it('performs a backup', async function () {
    await tools.backups.perform();
    await timeout(BackupDuration);
    const backupsLocation = await tools.backups.location();
    const files = await fs.readdir(backupsLocation);
    assert(files.length >= 1);
  });
  it('changes backups folder location', async function () {
    await tools.backups.perform();
    let newLocation = path.join(await tools.paths.userData(), 'newLocation');
    const currentLocation = await tools.backups.location();
    const fileNames = await fs.readdir(currentLocation);
    await tools.backups.changeLocation(newLocation);
    newLocation = path.join(newLocation, BackupsDirectoryName);
    assert.deepEqual(
      fileNames,
      await fs.readdir(newLocation)
    );

    /** Assert that the setting was saved */
    const data = await tools.store.diskData();
    assert.equal(data[StoreKeys.BackupsLocation], newLocation);

    /** Perform backup and make sure there is one more file in the directory */
    await tools.backups.perform();
    await timeout(BackupDuration);
    const newFileNames = await fs.readdir(newLocation);
    assert.deepEqual(newFileNames.length, fileNames.length + 1);
  });

  it('backups are enabled by default', async function () {
    assert.equal(await tools.backups.enabled(), true);
  });

  it('does not save a backup when they are disabled', async function () {
    await tools.backups.toggleEnabled();
    await tools.backups.perform();
    await timeout(BackupDuration);
    const backupsLocation = await tools.backups.location();
    try {
      await fs.readdir(backupsLocation);
      assert.fail(
        `A backups folder is present when backups have been disabled right
        after the app started.`
      );
    } catch (error) {
      assert.equal(error.code, FileDoesNotExist);
    }
  });
});
