import { strict as assert } from 'assert';
import 'mocha';
import { lowercaseDriveLetter } from '../app/javascripts/main/utils';

describe('Utilities', function () {
  describe('lowerCaseDriveLetter', function () {
    it("converts the drive letter of a given file's path to lower case", function () {
      assert.equal(lowercaseDriveLetter('/C:/Lansing'), '/c:/Lansing');
      assert.equal(lowercaseDriveLetter('/c:/Bone Rage'), '/c:/Bone Rage');
      assert.equal(
        lowercaseDriveLetter('/C:/Give/Us/the/Gold'),
        '/c:/Give/Us/the/Gold'
      );
    });

    it('only changes the drive letter', function () {
      assert.equal(lowercaseDriveLetter('C:/Hold Me In'), 'C:/Hold Me In');
      assert.equal(
        lowercaseDriveLetter('/Cd:/Egg Replacer'),
        '/Cd:/Egg Replacer'
      );
      assert.equal(
        lowercaseDriveLetter('/C:radle of Rocks'),
        '/C:radle of Rocks'
      );
    });
  });
});
