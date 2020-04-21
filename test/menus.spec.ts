import { strict as assert } from 'assert';
import { MenuItem } from 'electron';
import 'mocha';
import { MenuId } from '../app/javascripts/main/menus';
import { AppName } from '../app/javascripts/main/strings';
import { setDefaults, tools } from './tools';

describe('Menus', function () {
  setDefaults(this);
  before(async function () {
    await tools.launchApp();
  });
  after(tools.stopApp);

  let menuItems: MenuItem[];

  beforeEach(async function () {
    menuItems = await tools.appMenu.items();
  });

  function findSpellCheckerLanguagesMenu() {
    return menuItems.find((item) => {
      if (item.role.toLowerCase() === 'editmenu') {
        return item?.submenu?.items?.find(
          (item) => item.id === MenuId.SpellcheckerLanguages
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
      assert.equal(menuItems[0].role, 'editmenu');
    });

    it('shows the spellchecking submenu on Windows/Linux', function () {
      const menu = findSpellCheckerLanguagesMenu();
      assert(menu);
      assert(menu!.submenu!.items!.length > 0);
    });
  }
});
