import fs, { PathLike } from 'fs';
import path from 'path';
import yauzl from 'yauzl';

export const FileDoesNotExist = 'ENOENT';
export const FileAlreadyExists = 'EEXIST';
const CrossDeviceLink = 'EXDEV';

export async function readJSONFile<T>(filepath: string): Promise<T> {
  const data = await fs.promises.readFile(filepath, 'utf8');
  return JSON.parse(data);
}

export function readJSONFileSync<T>(filepath: string): T {
  const data = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(data);
}

export async function writeJSONFile(filepath: string, data: any) {
  await ensureDirectoryExists(path.dirname(filepath));
  await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
}

export function writeJSONFileSync(filepath: string, data: any) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

export async function ensureDirectoryExists(dirPath: string) {
  try {
    const stat = await fs.promises.lstat(dirPath);
    if (!stat.isDirectory()) {
      throw new Error(
        'Tried to create a directory where a file of the same ' +
          `name already exists: ${dirPath}`
      );
    }
  } catch (error) {
    if (error.code === FileDoesNotExist) {
      /**
       * No directory here. Make sure there is a *parent* directory, and then
       * create it.
       */
      await ensureDirectoryExists(path.dirname(dirPath));

      /** Now that its parent(s) exist, create the directory */
      try {
        await fs.promises.mkdir(dirPath);
      } catch (error) {
        if (error.code === FileAlreadyExists) {
          /**
           * A concurrent process must have created the directory already.
           * Make sure it *is* a directory and not something else.
           */
          await ensureDirectoryExists(dirPath);
        } else {
          throw error;
        }
      }
    } else {
      throw error;
    }
  }
}

/**
 * Deletes a directory (handling recursion.)
 * @param {string} dirPath the path of the directory
 */
export async function deleteDir(dirPath: string) {
  try {
    await deleteDirContents(dirPath);
  } catch (error) {
    if (error.code === FileDoesNotExist) {
      /** Directory has already been deleted. */
      return;
    }
    throw error;
  }
  await fs.promises.rmdir(dirPath);
}

export async function deleteDirContents(dirPath: string) {
  const children = await fs.promises.readdir(dirPath, {
    withFileTypes: true,
  });
  for (const child of children) {
    const childPath = path.join(dirPath, child.name);
    if (child.isDirectory()) {
      await deleteDirContents(childPath);
      await fs.promises.rmdir(childPath);
    } else {
      await fs.promises.unlink(childPath);
    }
  }
}

export async function moveDirContents(srcDir: string, destDir: string) {
  const [fileNames] = await Promise.all([
    fs.promises.readdir(srcDir),
    ensureDirectoryExists(destDir),
  ]);
  return Promise.all(
    fileNames.map(async (fileName) =>
      moveFile(
        path.join(srcDir, fileName),
        path.join(destDir, fileName)
      )
    )
  );
}

export async function extractNestedZip(source: string, dest: string) {
  return new Promise((resolve, reject) => {
    yauzl.open(
      source,
      { lazyEntries: true, autoClose: true },
      (err, zipFile) => {
        let cancelled = false;
        const tryReject = (err: Error) => {
          if (!cancelled) {
            cancelled = true;
            reject(err);
          }
        };
        if (err) return tryReject(err);
        if (!zipFile) return tryReject(new Error('zipFile === undefined'));

        zipFile.readEntry();
        zipFile.on('close', resolve);
        zipFile.on('entry', (entry) => {
          if (cancelled) return;
          if (entry.fileName.endsWith('/')) {
            /** entry is a directory, skip and read next entry */
            zipFile.readEntry();
            return;
          }

          zipFile.openReadStream(entry, async (err, stream) => {
            if (cancelled) return;
            if (err) return tryReject(err);
            if (!stream) return tryReject(new Error('stream === undefined'));
            stream.on('error', tryReject);
            const filepath = path.join(
              dest,
              /**
               * Remove the first element of the entry's path, which is the base
               * directory we want to ignore
               */
              entry.fileName.substring(entry.fileName.indexOf('/') + 1)
            );
            try {
              await ensureDirectoryExists(path.dirname(filepath));
            } catch (error) {
              return tryReject(error);
            }
            const writeStream = fs
              .createWriteStream(filepath)
              .on('error', tryReject)
              .on('error', tryReject);

            stream.pipe(writeStream).on('close', () => {
              zipFile.readEntry(); /** Reads next entry. */
            });
          });
        });
      }
    );
  });
}

async function moveFile(source: PathLike, destination: PathLike) {
  try {
    await fs.promises.rename(source, destination);
  } catch (error) {
    if (error.code === CrossDeviceLink) {
      /** Fall back to copying and then deleting. */
      await fs.promises.copyFile(source, destination);
      await fs.promises.unlink(source);
    } else {
      throw error;
    }
  }
}
