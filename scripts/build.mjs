import { spawn } from 'child_process';

function runCommand(fullCommand, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    console.log(fullCommand);
    const [command, ...args] = fullCommand.split(' ');
    const options = { env: Object.assign({}, process.env, extraEnv) };
    const child = spawn(command, args, options);
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
const appimageArm64 = 'appimage-arm64';
const dir = 'dir';
const dirArm64 = 'dir-arm64';
const mac = 'mac';
const snap = 'snap';
const snapArm64 = 'snap-arm64';
const deb = 'deb';
const debArm64 = 'deb-arm64';
const windows = 'windows';
const arm64Env = { npm_config_target_arch: 'arm64' };
const availableTargets = [
  appimage,
  appimageX64,
  appimageArm64,
  deb,
  debArm64,
  dir,
  dirArm64,
  mac,
  snap,
  snapArm64,
  windows,
];

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
      case appimageArm64:
        await runCommand('yarn run webpack --config webpack.prod.js', arm64Env);
        await runCommand(
          'yarn run electron-builder --linux --arm64 -c.linux.target=AppImage --publish=never',
          arm64Env
        );
        break;
      case deb:
        await runCommand('yarn run webpack --config webpack.prod.js --env deb');
        await runCommand(
          'yarn run electron-builder --linux --x64 --ia32 -c.linux.target=deb --publish=never'
        );
        break;
      case debArm64:
        await runCommand(
          'yarn run webpack --config webpack.prod.js --env deb',
          arm64Env
        );
        await runCommand(
          'yarn run electron-builder --linux --arm64 -c.linux.target=deb --publish=never',
          { npm_config_target_arch: 'arm64', USE_SYSTEM_FPM: 'true' }
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
      case dirArm64:
        await runCommand('yarn run webpack --config webpack.prod.js', arm64Env);
        await runCommand(
          'yarn run electron-builder --linux --arm64 -c.linux.target=dir --publish=never',
          arm64Env
        );
        break;
      case snap:
        await runCommand(
          'yarn run webpack --config webpack.prod.js --env snap'
        );
        await runCommand(
          'yarn run electron-builder --linux --x64 -c.linux.target=snap --publish=never'
        );
        break;
      case snapArm64:
        await runCommand(
          'yarn run webpack --config webpack.prod.js --env snap',
          arm64Env
        );
        await runCommand(
          'yarn run electron-builder --linux --arm64 -c.linux.target=snap --publish=never',
          {
            npm_config_target_arch: 'arm64',
            SNAPCRAFT_BUILD_ENVIRONMENT: 'host',
          }
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
