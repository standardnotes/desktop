import { spawn } from 'child_process';

function runCommand(fullCommand) {
  return new Promise((resolve, reject) => {
    console.log(fullCommand);
    const [command, ...args] = fullCommand.split(' ');
    const child = spawn(command, args);
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code > 0) {
        reject(code);
      } else {
        resolve(code);
      }
    });
  });
}

const appimage = 'appimage';
const appimageX64 = 'appimage-x64';
const dir = 'dir';
const mac = 'mac';
const snap = 'snap';
const deb = 'deb';
const windows = 'windows';
const availableTargets = [appimage, appimageX64, dir, mac, snap, deb, windows];

(async () => {
  try {
    const target = process.argv[2];
    if (!target) {
      throw Error(
        `No target specified. Available targets: ${availableTargets.join(', ')}`
      );
    } else if (!availableTargets.includes(target)) {
      throw Error(
        `Unknown target '${target}'. Available target: ${availableTargets.join(
          ', '
        )}`
      );
    }

    await runCommand('yarn clean:build');
    switch (target) {
      case appimage:
        await runCommand('yarn run webpack --config webpack.prod.js');
        await runCommand(
          'yarn run electron-builder --linux --x64 --ia32 -c.linux.target=AppImage --publish=never'
        );
        break;
      case appimageX64:
        await runCommand('yarn run webpack --config webpack.prod.js');
        await runCommand(
          'yarn run electron-builder --linux --x64 -c.linux.target=AppImage --publish=never'
        );
        break;
      case mac:
        await runCommand('yarn run webpack --config webpack.prod.js');
        await runCommand(
          'yarn run electron-builder --mac --x64 --publish=never'
        );
        await runCommand('node scripts/fix-mac-zip');
        break;
      case dir:
        await runCommand('yarn run webpack --config webpack.prod.js');
        await runCommand(
          'yarn run electron-builder --linux --x64 -c.linux.target=dir --publish=never'
        );
        break;
      case snap:
        await runCommand(
          'yarn run webpack --config webpack.prod.js --env snap'
        );
        await runCommand(
          'yarn run electron-builder --linux --x64 --ia32 -c.linux.target=snap --publish=never'
        );
        break;
      case deb:
        await runCommand('yarn run webpack --config webpack.prod.js --env deb');
        await runCommand(
          'yarn run electron-builder --linux --x64 --ia32 -c.linux.target=deb --publish=never'
        );
        break;
      case windows:
        await runCommand('yarn run webpack --config webpack.prod.js');
        await runCommand(
          'yarn run electron-builder --windows --x64 --ia32 --publish=never'
        );
        break;
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
})();
