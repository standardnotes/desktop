import { strict as assert } from 'assert';
import 'mocha';
import { Language } from '../app/javascripts/main/spellcheckerManager';
import { StoreKeys } from '../app/javascripts/main/store';
import { tools, setDefaults } from './tools';

describe('Spellchecker', function () {
  setDefaults(this);
  before(tools.launchApp);
  after(tools.stopApp);

  if (process.platform === 'darwin') {
    it('Does not create a manager on Mac', async function () {
      assert(!(await tools.spellchecker.manager()));
    });
  } else {
    const language = Language.CS;
    it('adds a clicked language menu item to the store and session\'s languages', async function () {
      await tools.appMenu.clickLanguage(language);
      const data = await tools.store.diskData();
      assert(
        data[StoreKeys.SelectedSpellCheckerLanguageCodes].includes(language)
      );
      assert((await tools.spellchecker.languages()).includes(language));
    });
    it('Removes a clicked language menu item to the store\'s and session\'s languages', async function () {
      await tools.appMenu.clickLanguage(language);
      const data = await tools.store.diskData();
      assert(
        !data[StoreKeys.SelectedSpellCheckerLanguageCodes].includes(language)
      );
      assert(!(await tools.spellchecker.languages()).includes(language));
    });
  }
});
