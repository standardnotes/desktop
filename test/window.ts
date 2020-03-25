import { strict as assert } from 'assert';
import 'mocha';
import { launchApp, setDefaults } from './utils';

describe('Single-window behavior', function() {
  setDefaults(this);

  it('only has one window', async function() {
    const app = await launchApp();
    assert.equal(await app.client.getWindowCount(), 1);
    await app.stop();
  });
});
