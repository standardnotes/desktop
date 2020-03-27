import { ensureDirectoryExists } from './fileUtils';
import https from 'https';
import { IncomingMessage } from 'http';
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
let { pipeline } = require('stream');
pipeline = promisify(pipeline);

/**
 * Downloads a file to the specified destination.
 * @param filePath path to the saved file (will be created if it does
 * not exist)
 */
export async function downloadFile(url: string, filePath: string) {
  await ensureDirectoryExists(path.dirname(filePath));
  const response = await get(url);
  await pipeline(response, fs.createWriteStream(filePath));
}

export async function getJSON<T extends Object>(url: string): Promise<T> {
  const response = await get(url);
  response.setEncoding('utf-8');
  let data = '';
  return new Promise((resolve, reject) => {
    response
      .on('data', chunk => {
        data += chunk;
      })
      .on('error', reject)
      .on('close', () => {
        resolve(JSON.parse(data));
      });
  });
}

/**
 * Performs an HTTPS GET request, following redirects.
 * DOES NOT handle compressed responses.
 * @param {string} url the url of the file to get
 */
async function get(url: string, maxRedirects = 3) {
  let redirects = 0;
  let response = await promiseGet(url);
  while (
    response.statusCode &&
    response.statusCode >= 300 &&
    response.statusCode < 400 &&
    response.headers.location &&
    redirects < maxRedirects
  ) {
    redirects += 1;
    response = await promiseGet(response.headers.location);
  }
  return response;
}

/**
 * The https module's get function, promisified.
 * @param {string} url
 * @returns The response stream.
 */
function promiseGet(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    https.get(url, resolve).on('error', reject);
  });
}
