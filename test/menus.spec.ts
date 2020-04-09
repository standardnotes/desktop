import { strict as assert } from 'assert';
import { MenuItem } from 'electron';
import 'mocha';
import {
  AppName,
  initializeStrings,
  str,
} from '../app/javascripts/main/strings';
import { tools, setDefaults } from './tools';

describe('Menus', function () {
  setDefaults(this);
  before(async function () {
    await tools.launchApp();
    initializeStrings('en');
  });
  after(tools.stopApp);

  let menuItems: MenuItem[];

  beforeEach(async function () {
    menuItems = await tools.appMenu.items();
  });

  function findSpellCheckerLanguagesMenu() {
    return menuItems.find((item) => {
      if (item.label === str().appMenu.edit) {
        return item?.submenu?.items?.find(
          (item) => item.label === str().appMenu.spellcheckerLanguages
        );
      }
    });
  }
  if (process.platform === 'darwin') {
    it('shows the App menu on Mac', async function () {
      assert.equal(menuItems[0].label, AppName);
    });

    it('hides the spellchecking submenu on Mac', function () {
      assert(!findSpellCheckerLanguagesMenu());
    });
  } else {
    it('hides the App menu on Windows/Linux', function () {
      assert.equal(menuItems[0].label, str().appMenu.edit);
    });

    it('shows the spellchecking submenu on Windows/Linux', function () {
      const menu = findSpellCheckerLanguagesMenu();
      assert(menu);
      assert(menu!.submenu!.items!.length > 0);
    });
  }
});
