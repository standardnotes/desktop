import test from 'ava';
import { promises as fs } from 'fs';
import path from 'path';
import {
  deleteDir,
  ensureDirectoryExists,
  extractNestedZip,
  FileDoesNotExist,
  moveDirContents,
  readJSONFile,
  writeJSONFile,
} from '../app/javascripts/main/fileUtils';

const dataPath = path.join(__dirname, 'data');
const tmpPath = path.join(dataPath, 'tmp', path.basename(__filename));
const zipFileDestination = path.join(tmpPath, 'zip-file-output');
const root = path.join(tmpPath, 'tmp1');

test.before(async () => {
  await ensureDirectoryExists(tmpPath);
});

test.after(async () => {
  await deleteDir(tmpPath);
});

test('extracts a zip and unnests the folders by one level', async (t) => {
  await extractNestedZip(
    path.join(dataPath, 'zip-file.zip'),
    zipFileDestination
  );
  t.deepEqual(await fs.readdir(zipFileDestination), [
    'package.json',
    'test-file.txt',
  ]);
});

test('creates a directory even when parent directories are non-existant', async (t) => {
  await ensureDirectoryExists(path.join(root, 'tmp2', 'tmp3'));
  t.deepEqual(await fs.readdir(root), ['tmp2']);
  t.deepEqual(await fs.readdir(path.join(root, 'tmp2')), ['tmp3']);
});

test('deletes a deeply-nesting directory', async (t) => {
  await deleteDir(path.join(root));
  try {
    await fs.readdir(path.join(tmpPath, 'tmp1'));
    t.fail('Should not have been able to read');
  } catch (error) {
    if (error.code === FileDoesNotExist) {
      t.pass();
    } else {
      t.fail(error);
    }
  }
});

test('moves the contents of one directory to the other', async (t) => {
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
      t.is(contents, fileName);
    })
  );
});

test('serializes and deserializes an object to the same values', async (t) => {
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
  t.deepEqual(data, await readJSONFile(filePath));
});
