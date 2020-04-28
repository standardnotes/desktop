import path from 'path';
import {
  deleteDir,
  ensureDirectoryExists,
} from '../app/javascripts/main/fileUtils';

export function createTmpDir(name: string) {
  const tmpDirPath = path.join(__dirname, 'data', 'tmp', path.basename(name));

  return {
    path: tmpDirPath,
    async make(): Promise<string> {
      await ensureDirectoryExists(tmpDirPath);
      return tmpDirPath;
    },
    async clean() {
      await deleteDir(tmpDirPath);
    },
  };
}
