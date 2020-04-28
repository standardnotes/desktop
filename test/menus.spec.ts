import anyTest, { TestInterface } from 'ava';
import { MenuItem } from 'electron';
import { MenuId } from '../app/javascripts/main/menus';
import { AppName } from '../app/javascripts/main/strings';
import { createDriver, Driver } from './driver';

const test = anyTest as TestInterface<{
  driver: Driver;
  menuItems: MenuItem[];
}>;

test.before(async (t) => {
  t.context.driver = await createDriver();
});

test.after.always(async (t) => {
  await t.context.driver.stop();
});

test.beforeEach(async (t) => {
  t.context.menuItems = await t.context.driver.appMenu.items();
});

function findSpellCheckerLanguagesMenu(menuItems: MenuItem[]) {
  return menuItems.find((item) => {
    if (item.role?.toLowerCase() === 'editmenu') {
      return item?.submenu?.items?.find(
        (item) => item.id === MenuId.SpellcheckerLanguages
      );
    }
  });
}
if (process.platform === 'darwin') {
  test('shows the App menu on Mac', (t) => {
    t.is(t.context.menuItems[0].role.toLowerCase(), 'appmenu');
    t.is(t.context.menuItems[0].label, AppName);
  });

  test('hides the spellchecking submenu on Mac', (t) => {
    t.falsy(findSpellCheckerLanguagesMenu(t.context.menuItems));
  });
} else {
  test('hides the App menu on Windows/Linux', (t) => {
    t.is(t.context.menuItems[0].role.toLowerCase(), 'editmenu');
  });

  test('shows the spellchecking submenu on Windows/Linux', (t) => {
    const menu = findSpellCheckerLanguagesMenu(t.context.menuItems);
    t.truthy(menu);
    t.true(menu!.submenu!.items!.length > 0);
  });
}
