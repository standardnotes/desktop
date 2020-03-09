const Application = require('spectron').Application;
const assert = require('assert').strict;
const electronPath = require('electron');
const path = require('path');
const {
  CommandLineArgs
} = require('../app/javascripts/shared/CommandLineArgs');

const TenSeconds = 10000;

async function launchApp({ testing = true } = {}) {
  const app = new Application({
    path: electronPath,
    args: [
      /**
       * Tells spectron to look for and use the package.json file
       * located 1 level above.
       */
      path.join(__dirname, '..'),
      '--icon',
      '_icon/icon.png',
      ...(testing ? [CommandLineArgs.Testing] : [])
    ]
  });
  await app.start();
  return app;
}

describe('Application launch', function() {
  this.timeout(TenSeconds);

  let app;

  afterEach(async function() {
    if (app && app.isRunning()) {
      await app.stop();
    }
    app = null;
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
