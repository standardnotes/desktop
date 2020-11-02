import path from 'path';
import index from '../../index.html';
import grantKeyringAccess from '../../grantKeyringAccess.html';

export const indexHtml = htmlPath(index);
export const grantKeyringAccessHtml = htmlPath(grantKeyringAccess);
export const preloadJsPath = path.join(
  __dirname,
  'javascripts/renderer/preload.js'
);
export const grantKeyringAccessJsPath = path.join(
  __dirname,
  'javascripts/renderer/grantKeyringAccess.js'
);

function htmlPath(fileName: string): string {
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
