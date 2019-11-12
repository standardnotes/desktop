// See: https://medium.com/@TwitterArchiveEraser/notarize-electron-apps-7a5f988406db

/*
  There is an issue with electron-builder generating invalid zip files for Catalina.
  This is the workaround: https://snippets.cacher.io/snippet/354a3eb7b0dcbe711383

  1. From [app_root] folder, run: electron-builder --publish always. Wait for notarization to complete.
  2. Go to Finder and right-click to compress dist/mac/[YourApp.app]. (This can be scripted with 7zip.)
  3. Rename the zip to [YourApp]-${version}-mac.zip. Overwrite the file with the same name in /dist.
  4. Run ./node_modules/app-builder-bin/mac/app-builder blockmap -i dist/[YourApp]-${version}-mac.zip to get update file info: size, sha512, blockMapSize.
  5. Update dist/latest-mac.yml with the info found from step 4.
  6. Manually upload [YourApp]-${version}-mac.zip and dist/latest-mac.yml to S3/DigitalOcean/Wherever.
 */

const fs = require('fs');
const path = require('path');
var electron_notarize = require('electron-notarize');

module.exports = async function (params) {
    let platformName = params.electronPlatformName;
    // Only notarize the app on Mac OS only.
    if (platformName !== 'darwin') {
        return;
    }
    console.log('afterSign hook triggered', params);

    // Same appId in electron-builder.
    let appId = 'org.standardnotes.standardnotes'

    let appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);
    if (!fs.existsSync(appPath)) {
        throw new Error(`Cannot find application at: ${appPath}`);
    }

    console.log(`Notarizing ${appId} found at ${appPath}`);

    try {
        await electron_notarize.notarize({
            appBundleId: appId,
            appPath: appPath,
            appleId: process.env.notarizeAppleId,
            appleIdPassword: process.env.notarizeAppleIdPassword,
        });
    } catch (error) {
        console.error(error);
    }

    console.log(`Done notarizing ${appId}`);
};
