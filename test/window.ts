import { strict as assert } from 'assert';
import 'mocha';
import { launchApp, setDefaults } from './utils';
import { Application } from 'spectron';

describe('Single-window behavior', function() {
  setDefaults(this);

  let app: Application;
  beforeEach(async function() {
    app = await launchApp();
  });
  afterEach(async function() {
    if (app && app.isRunning) {
      await app.stop();
    }
  });

  it('only has one window', async function() {
    assert.equal(await app.client.getWindowCount(), 1);
  });
});
