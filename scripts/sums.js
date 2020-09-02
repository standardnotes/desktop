const crypto = require('crypto');
const fs = require('fs');

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(crypto.createHash('sha256').setEncoding('hex'))
      .on('finish', function () {
        resolve(this.read());
      })
      .on('error', reject);
  });
}

(async () => {
  console.log('Writing SHA256 sums to dist/SHA256SUMS');

  try {
    const version = JSON.parse(fs.readFileSync('./package.json')).version;
    const files = [
      `standard-notes-${version}-mac.zip`,
      `standard-notes-${version}-mac.dmg`,
      `standard-notes-${version}-mac.dmg.blockmap`,

      `standard-notes-${version}-linux-i386.AppImage`,
      `standard-notes-${version}-linux-x86_64.AppImage`,
      `standard-notes-${version}-linux-amd64.snap`,

      `standard-notes-${version}-win.exe`,
      `standard-notes-${version}-win.exe.blockmap`,

      'latest-linux-ia32.yml',
      'latest-linux.yml',
      'latest-mac.yml',
      'latest.yml',
    ];

    process.chdir('dist');

    let hashes = await Promise.all(
      files.map(async (fileName) => {
        const hash = await sha256(fileName);
        return `${hash}  ${fileName}`;
      })
    );
    hashes = hashes.join('\n');
    await fs.promises.writeFile('SHA256SUMS', hashes);
    console.log(`Successfully wrote SHA256SUMS:\n${hashes}`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
