import { app } from 'electron';
import fs from 'fs';
import http, { IncomingMessage, ServerResponse } from 'http';
import mime from 'mime-types';
import path from 'path';
import { URL } from 'url';
import { FileDoesNotExist } from './fileUtils';
import { extensions as str } from './strings';

const Protocol = 'http';
const UserDataPath = app.getPath('userData');

function logError(...message: any) {
  console.error('extServer:', ...message);
}

function log(...message: any) {
  console.log('extServer:', ...message);
}

export function normalizeFilePath(requestUrl: string, host: string) {
  if (!requestUrl.startsWith('/Extensions')) {
    throw new Error(
      `URL '${requestUrl}' falls outside of the Extensions domain.`
    );
  }
  const url = new URL(
    requestUrl.replace('/Extensions', ''),
    `${Protocol}://${host}`
  );
  /**
   * Normalize path (parse '..' and '.') so that we prevent path traversal by
   * joining a fully resolved path to the Extensions dir.
   */
  const modifiedReqUrl = path.normalize(url.pathname);
  return path.join(UserDataPath, 'Extensions', modifiedReqUrl);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!req.url) throw new Error('No url.');
    if (!req.headers.host) throw new Error('No `host` header.');

    const filePath = normalizeFilePath(req.url, req.headers.host);
    const stat = await fs.promises.lstat(filePath);
    if (!stat.isFile()) {
      throw new Error('Client requested something that is not a file.');
    }
    const ext = path.parse(filePath).ext;
    const mimeType = mime.lookup(ext);
    res.setHeader('Content-Type', `${mimeType}; charset=utf-8`);
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
    });
    const stream = fs.createReadStream(filePath);
    stream.on('error', (error: Error) => onRequestError(error, res));
    stream.pipe(res);
  } catch (error) {
    onRequestError(error, res);
  }
}

function onRequestError(error: Error | { code: string }, res: ServerResponse) {
  let responseCode: number;
  let message: string;
  if ('code' in error && error.code === FileDoesNotExist) {
    responseCode = 404;
    message = str().missingExtension;
  } else {
    logError(error);
    responseCode = 500;
    message = str().unableToLoadExtension;
  }
  res.writeHead(responseCode);
  res.write(message);
  res.end();
}

export function createExtensionsServer(done?: () => void) {
  const port = 45653;
  const ip = '127.0.0.1';
  const host = `${Protocol}://${ip}:${port}/`;
  http.createServer(handleRequest).listen(port, ip, () => {
    log(`Server started at ${host}`);
    if (done) {
      done();
    }
  });
  return host;
}
