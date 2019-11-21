const {app} = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const url = require('url');

const mimes = {
  '.ico': 'image/x-icon',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

let instance = null;

class ExtensionsServer {

  static instance() {
    if(instance == null) {
      instance = new ExtensionsServer();
    }
    return instance;
  }

  constructor() {
    this.port = 45653;
  }

  getHost() {
    return `http://localhost:${this.port}/`;
  }

  createServer() {
    function handleRequest(req, res) {
      const extensionsFolder = "Extensions";
      const extensionsDir = path.join(app.getPath('userData'), extensionsFolder);
      const pathName = url.parse(req.url).pathname;
      const modifiedReqUrl = pathName.replace(extensionsFolder, "");
      const filePath = path.join(extensionsDir, modifiedReqUrl);

      fs.exists(filePath, function(exists) {
        if(exists && fs.lstatSync(filePath).isFile()) {
          const ext = path.parse(filePath).ext;
          const mimeType = mime.lookup(ext);
          res.setHeader("Content-Type", `${mimeType}; charset=utf-8`);
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*'
          });
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        res.writeHead(404);
        res.write('404 Not Found');
        res.end();
      });
    }

    var server = http.createServer(handleRequest);
    server.listen(this.port, () => {
      console.log(`Extensions server started at http://localhost:${this.port}`);
    });
  }
}

module.exports = ExtensionsServer;
