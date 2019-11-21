const {app} = require('electron');
var http = require('http');
var fs = require('fs');
var path = require('path');

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
      const modifiedReqUrl = req.url.replace(extensionsFolder, "");
      const filePath = path.join(extensionsDir, modifiedReqUrl);

      fs.exists(filePath, function(exists) {
        if(exists && fs.lstatSync(filePath).isFile()) {
          const ext = path.parse(filePath).ext;
          res.setHeader("Content-Type", mimes[ext] || 'text/plain');
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
