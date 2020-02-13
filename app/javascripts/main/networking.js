import { ensureDirectoryExists } from "./fileUtils";
const https = require("https");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
let { pipeline } = require("stream");
pipeline = promisify(pipeline);

/**
 * Downloads a file to the specified destination.
 * @param {string} url url of the file
 * @param {string} filePath path to the saved file (will be created if it does
 * not exist)
 */
export async function downloadFile(url, filePath) {
  await ensureDirectoryExists(path.dirname(filePath));
  const response = await get(url);
  await pipeline(response, fs.createWriteStream(filePath));
}

export async function getJSON(url) {
  const response = await get(url);
  response.setEncoding("utf-8");
  let data = "";
  return new Promise((resolve, reject) => {
    response
      .on("data", chunk => {
        data += chunk;
      })
      .on("error", reject)
      .on("close", () => {
        resolve(JSON.parse(data));
      });
  });
}

/**
 * Performs an HTTPS GET request, following redirects.
 * DOES NOT handle compressed responses.
 * @param {string} url the url of the file to get
 */
async function get(url, maxRedirects = 3) {
  let redirects = 0;
  let response = await promiseGet(url);
  while (
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
 * @returns {Promise<ReadableStream>} The response stream.
 */
function promiseGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, resolve).on("error", reject);
  });
}
