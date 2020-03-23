import { Strings } from './types';

export function createEnglishStrings(): Strings {
  return {
    appMenu: {
      edit: 'Edit',
      view: 'View',
      hideMenuBar: 'Hide Menu Bar',
      useThemedMenuBar: 'Use Themed Menu Bar',
      minimizeToTrayOnClose: 'Minimize To Tray On Close',
      backups: 'Backups',
      automaticUpdatesEnabled: 'Automatic Updates Enabled',
      automaticUpdatesDisabled: 'Automatic Updates Disabled',
      disableAutomaticBackups: 'Disable Automatic Backups',
      enableAutomaticBackups: 'Enable Automatic Backups',
      changeBackupsLocation: 'Change Backups Location',
      openBackupsLocation: 'Open Backups Location',
      emailSupport: 'Email Support',
      website: 'Website',
      gitHub: 'GitHub',
      slack: 'Slack',
      twitter: 'Twitter',
      toggleErrorConsole: 'Toggle Error Console',
      openDataDirectory: 'Open Data Directory',
      clearCacheAndReload: 'Clear Cache and Reload',
      speech: 'Speech',
      close: 'Close',
      minimize: 'Minimize',
      zoom: 'Zoom',
      bringAllToFront: 'Bring All to Front',
      checkForUpdate: 'Check for Update',
      checkingForUpdate: 'Checking for update…',
      updateAvailable: '(1) Update Available',
      updates: 'Updates',
      errorRetrieving: 'Error Retrieving',
      openDownloadLocation: 'Open Download Location',
      downloadingUpdate: 'Downloading Update…',
      manuallyDownloadUpdate: 'Manually Download Update',
      spellcheckerLanguages: 'Spellchecker Languages',
      installPendingUpdate(versionNumber: string) {
        return `Install Pending Update (${versionNumber})`;
      },
      lastUpdateCheck(date: Date) {
        return `Last checked ${date.toLocaleString()}`;
      },
      version(number: string) {
        return `Version: ${number}`;
      },
      yourVersion(number: string) {
        return `Your Version: ${number}`;
      },
      latestVersion(number: string) {
        return `Latest Version: ${number}`;
      },
      viewReleaseNotes(versionNumber: string) {
        return `View ${versionNumber} Release Notes`;
      },
      preferencesChanged: {
        title: 'Preference Changed',
        message:
          'Your menu bar preference has been saved. Please restart the ' +
          'application for the change to take effect.'
      }
    },
    tray: {
      show: 'Show',
      hide: 'Hide',
      quit: 'Quit'
    },
    extensions: {
      unableToLoadExtension:
        'Unable to load extension. Please restart the application and ' +
        'try again. If the issue persists, try uninstalling then ' +
        'reinstalling the extension.'
    }
  };
}
