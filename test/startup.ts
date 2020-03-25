import { strict as assert } from 'assert';
import 'mocha';
import { Suite } from 'mocha';
import { Application } from 'spectron';
import { CommandLineArgs } from '../app/javascripts/shared/CommandLineArgs';
import { launchApp, setDefaults } from './utils';

describe('Application launch', function(this: Suite) {
  setDefaults(this);

  let app: Application;

  afterEach(async function() {
    if (app && app.isRunning()) {
      await app.stop();
    }
  });

  it('has node integration disabled', async function() {
    /**
     * The app shouldn't have node integration enabled. To ensure
     * this is the case, we check `app.electron`, which should be undefined.
     */
    app = await launchApp({ testing: false });
    assert(!app.electron);
  });

  it(`has node integration enabled with ${CommandLineArgs.Testing}`, async function() {
    /**
     * We need node integration for all the testing utilities to work. For that
     * we pass a special flag to the app.
     */
    app = await launchApp();
    assert(app.electron);
  });
});
