import { strict as assert } from 'assert';
import { CommandLineArgs } from '../app/javascripts/shared/CommandLineArgs';
import { tools, setDefaults } from './tools';

describe('Application launch', function () {
  setDefaults(this);
  afterEach(tools.stopApp);

  it('has node integration disabled', async function () {
    /**
     * The app shouldn't have node integration enabled. To ensure
     * this is the case, we check `app.electron`, which should be undefined.
     */
    await tools.launchApp({ testing: false });
    assert(!tools.app.electron);
  });

  it(`has node integration enabled with ${CommandLineArgs.Testing}`, async function () {
    /**
     * We need node integration for all the testing utilities to work. For that
     * we pass a special flag to the app.
     */
    await tools.launchApp();
    assert(tools.app!.electron);
  });
});
