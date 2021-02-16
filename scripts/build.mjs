import { execSync } from 'child_process';

function runCommand(command) {
  console.log(command);
  execSync(command);
}

const appimage = 'appimage';
const mac = 'mac';
const snap = 'snap';
const windows = 'windows';
const availableTargets = [appimage, mac, snap, windows];

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

  runCommand('yarn clean:build');
  switch (target) {
    case appimage:
      runCommand('yarn run webpack --config webpack.prod.js');
      runCommand(
        'yarn run electron-builder --linux --x64 --ia32 -c.linux.target=AppImage'
      );
      break;
    case mac:
      runCommand('yarn run webpack --config webpack.prod.js --env snap');
      runCommand('yarn run electron-builder --mac --x64');
      runCommand('node scripts/fix-mac-zip');
      break;
    case snap:
      runCommand('yarn run webpack --config webpack.prod.js --env snap');
      runCommand(
        'yarn run electron-builder --linux --x64 --ia32 -c.linux.target=snap'
      );
      break;
    case windows:
      runCommand('yarn run webpack --config webpack.prod.js --env snap');
      runCommand('yarn run electron-builder --windows --x64 --ia32');
      break;
  }
} catch (e) {
  console.error(e.toString());
  process.exitCode = 1;
}
