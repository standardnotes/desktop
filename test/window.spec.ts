import { strict as assert } from 'assert';
import 'mocha';
import { tools, setDefaults } from './tools';

describe('Single-window behavior', function () {
  setDefaults(this);
  before(tools.launchApp);
  after(tools.stopApp);

  it('only has one window', async function () {
    assert.equal(await tools.app.client.getWindowCount(), 1);
  });
});
