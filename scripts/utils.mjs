import fs from 'fs';

export async function getLatestBuiltFilesList() {
  const packageJson = await fs.promises.readFile('./package.json');
  const version = JSON.parse(packageJson).version;
  return [
    `standard-notes-${version}-mac.zip`,
    `standard-notes-${version}-mac.dmg`,
    `standard-notes-${version}-mac.dmg.blockmap`,

    `standard-notes-${version}-linux-i386.AppImage`,
    `standard-notes-${version}-linux-x86_64.AppImage`,
    `standard-notes-${version}-linux-amd64.snap`,

    `standard-notes-${version}-linux-arm64.deb`,
    `standard-notes-${version}-linux-arm64.AppImage`,

    `standard-notes-${version}-win.exe`,
    `standard-notes-${version}-win.exe.blockmap`,

    'latest-linux-ia32.yml',
    'latest-linux.yml',
    'latest-linux-arm64.yml',
    'latest-mac.yml',
    'latest.yml',
    'builder-effective-config.yaml',
  ];
}

export async function getBuiltx64SnapFilename() {
  const packageJson = await fs.promises.readFile('./package.json');
  const version = JSON.parse(packageJson).version;
  return `standard-notes-${version}-linux-amd64.snap`;
}
