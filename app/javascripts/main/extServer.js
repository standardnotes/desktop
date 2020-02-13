import { UnableToLoadExtension } from "./strings";
import { FILE_DOES_NOT_EXIST } from "./fileUtils";

const { app } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const { URL } = require("url");

function normalizeFilePath(req) {
  const extensionsFolder = "Extensions";
  const extensionsDir = path.join(app.getPath("userData"), extensionsFolder);
  const pathName = new URL(req.url, `http://${req.headers.host}`).pathname;
  // Normalize path (parse '..' and '.') so that we prevent path traversal by
  // joining a fully resolved path to the Extensions dir.
  const modifiedReqUrl = path.normalize(pathName.replace(extensionsFolder, ""));
  return path.join(extensionsDir, modifiedReqUrl);
}

async function handleRequest(req, res) {
  try {
    const filePath = normalizeFilePath(req);
    const stat = await fs.promises.lstat(filePath);
    if (!stat.isFile()) {
      throw "Not a file.";
    }
    const ext = path.parse(filePath).ext;
    const mimeType = mime.lookup(ext);
    res.setHeader("Content-Type", `${mimeType}; charset=utf-8`);
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*"
    });
    const stream = fs.createReadStream(filePath);
    stream.on("error", error => onRequestError(error, res));
    stream.pipe(res);
  } catch (error) {
    onRequestError(error, res);
  }
}

function onRequestError(error, res) {
  console.error(error);
  const responseCode = error.code !== FILE_DOES_NOT_EXIST ? 404 : 500;
  res.writeHead(responseCode);
  res.write(UnableToLoadExtension);
  res.end();
}

export function createExtensionsServer() {
  const host = "http://localhost:45653/";
  http.createServer(handleRequest).listen(45653, "localhost", () => {
    console.log(`Extensions server started at ${host}`);
  });
  return host;
}
