import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import { Suite } from 'mocha';

import path from 'path';
import {
  deleteDir,
  ensureDirectoryExists,
  extractNestedZip,
  FileDoesNotExist,
  readJSONFile,
  writeJSONFile,
  moveDirContents,
} from '../app/javascripts/main/fileUtils';

describe('File utilities', function (this: Suite) {
  const dataPath = path.join(__dirname, 'data');
  const tmpPath = path.join(dataPath, 'tmp');

  beforeEach(async function () {
    await ensureDirectoryExists(tmpPath);
  });

  afterEach(async function () {
    await deleteDir(tmpPath);
  });

  describe('Unzip', function () {
    const zipFileDestination = path.join(tmpPath, 'zip-file-output');

    it('extracts a zip and unnests the folders by one level', async function () {
      await extractNestedZip(
        path.join(dataPath, 'zip-file.zip'),
        zipFileDestination
      );
      assert.deepStrictEqual(await fs.readdir(zipFileDestination), [
        'package.json',
        'test-file.txt',
      ]);
    });
  });

  describe('Directory', function () {
    const root = path.join(tmpPath, 'tmp1');
    it('creates a directory even when parent directories are non-existant', async function () {
      await ensureDirectoryExists(path.join(root, 'tmp2', 'tmp3'));
      assert.deepStrictEqual(await fs.readdir(root), ['tmp2']);
      assert.deepStrictEqual(await fs.readdir(path.join(root, 'tmp2')), [
        'tmp3',
      ]);
    });

    it('deletes a deeply-nesting directory', async function () {
      await deleteDir(path.join(root));
      try {
        await fs.readdir(path.join(tmpPath, 'tmp1'));
        assert.fail('Should not have been able to read');
      } catch (error) {
        if (error.code !== FileDoesNotExist) {
          assert.fail(error);
        }
      }
    });

    it('Moves the contents of one directory to the other', async function () {
      const fileNames = [
        '1.txt',
        '2.txt',
        '3.txt',
        'nested/4.txt',
        'nested/5.txt',
        'nested/6.txt',
      ];

      /** Create a temp directory and fill it with files */
      const dir = path.join(tmpPath, 'move_contents_src');
      await ensureDirectoryExists(dir);
      await ensureDirectoryExists(path.join(dir, 'nested'));
      await Promise.all(
        fileNames.map((fileName) =>
          fs.writeFile(path.join(dir, fileName), fileName)
        )
      );

      /** Now move its contents */
      const dest = path.join(tmpPath, 'move_contents_dest');
      await moveDirContents(dir, dest);
      await Promise.all(
        fileNames.map(async (fileName) => {
          const contents = await fs.readFile(path.join(dest, fileName), 'utf8');
          assert(contents === fileName);
        })
      );
    });
  });

  describe('JSON', function () {
    it('serializes and deserializes an object to the same values', async function () {
      const data = {
        meter: {
          4: 4,
        },
        chorus: {
          passengers: 2,
          destination: 'moon',
          activities: [{ type: 'play', environment: 'stars' }],
        },
      };
      const filePath = path.join(tmpPath, 'data.json');
      await writeJSONFile(filePath, data);
      assert.deepStrictEqual(data, await readJSONFile(filePath));
    });
  });
});
