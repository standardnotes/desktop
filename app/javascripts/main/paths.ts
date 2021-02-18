import path from 'path';
import index from '../../index.html';
import grantLinuxPasswordsAccess from '../../grantLinuxPasswordsAccess.html';
import decryptScript from 'decrypt/dist/decrypt.html';

export const indexUrl = url(index);
export const grantLinuxPasswordsAccessUrl = url(grantLinuxPasswordsAccess);
export const decryptScriptPath = filePath(decryptScript);
export const preloadJsPath = path.join(
  __dirname,
  'javascripts/renderer/preload.js'
);
export const grantLinuxPasswordsAccessJsPath = path.join(
  __dirname,
  'javascripts/renderer/grantLinuxPasswordsAccess.js'
);

function url(fileName: string): string {
  if ('APP_RELATIVE_PATH' in process.env) {
    return path.join(
      'file://',
      __dirname,
      process.env.APP_RELATIVE_PATH as string,
      fileName
    );
  }
  return path.join('file://', __dirname, fileName);
}

function filePath(fileName: string): string {
  if ('APP_RELATIVE_PATH' in process.env) {
    return path.join(
      __dirname,
      process.env.APP_RELATIVE_PATH as string,
      fileName
    );
  }
  return path.join(__dirname, fileName);
}
