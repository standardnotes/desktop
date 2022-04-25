import { DesktopDevice } from './DesktopDevice'
import { IpcMessages } from '../shared/ipcMessages'
import { DesktopCommunicationReceiver } from '@web/Device/DesktopWebCommunication'
import { StartApplication } from '@web/Device/StartApplication'
import { CrossProcessBridge } from './CrossProcessBridge'

declare const DEFAULT_SYNC_SERVER: string
declare const WEBSOCKET_URL: string
declare const ENABLE_UNFINISHED_FEATURES: string
declare const PURCHASE_URL: string
declare const PLANS_URL: string
declare const DASHBOARD_URL: string

declare global {
  interface Window {
    device: DesktopDevice
    dashboardUrl: string
    desktopCommunicationReceiver: DesktopCommunicationReceiver
    electronAppVersion: string
    ElectronValence: any
    enableUnfinishedFeatures: boolean
    plansUrl: string
    purchaseUrl: string
    startApplication: StartApplication
    zip: any
  }
}

const messageBus = new window.ElectronValence.FrameMessageBus()
const receiver = new window.ElectronValence.Receiver(messageBus)

function loadWindowVarsRequiredByWebApp() {
  window.dashboardUrl = DASHBOARD_URL
  window.enableUnfinishedFeatures = ENABLE_UNFINISHED_FEATURES === 'true'
  window.plansUrl = PLANS_URL
  window.purchaseUrl = PURCHASE_URL
}

;(async () => {
  loadWindowVarsRequiredByWebApp()

  await receiver.ready

  const mainThread: CrossProcessBridge = receiver.items[0]

  await configureWindow(mainThread)

  window.device = await createDesktopDevice(mainThread)

  window.startApplication(DEFAULT_SYNC_SERVER, window.device, window.enableUnfinishedFeatures, WEBSOCKET_URL)

  registerIpcMessageListener(window.device)
})()

loadZipLibrary()

/** @returns whether the keychain structure is up to date or not */
async function migrateKeychain(mainThread: CrossProcessBridge): Promise<boolean> {
  if (!(await mainThread.useNativeKeychain)) {
    /** User chose not to use keychain, do not migrate. */
    return false
  }

  const key = 'keychain'
  const localStorageValue = window.localStorage.getItem(key)

  if (localStorageValue) {
    /** Migrate to native keychain */
    console.warn('Migrating keychain from localStorage to native keychain.')
    window.localStorage.removeItem(key)
    await mainThread.setKeychainValue(JSON.parse(localStorageValue))
  }

  return true
}

async function createDesktopDevice(mainThread: CrossProcessBridge): Promise<DesktopDevice> {
  const useNativeKeychain = await migrateKeychain(mainThread)
  const extensionsServerHost = await mainThread.extServerHost
  const appVersion = await mainThread.appVersion

  return new DesktopDevice(mainThread, useNativeKeychain, extensionsServerHost, appVersion)
}

async function configureWindow(mainThread: CrossProcessBridge) {
  const [isMacOS, useSystemMenuBar, appVersion] = await Promise.all([
    mainThread.isMacOS,
    mainThread.useSystemMenuBar,
    mainThread.appVersion,
  ])

  window.electronAppVersion = appVersion

  /*
  Title bar events
  */
  document.getElementById('menu-btn')!.addEventListener('click', (e) => {
    mainThread.sendIpcMessage(IpcMessages.DisplayAppMenu, {
      x: e.x,
      y: e.y,
    })
  })

  document.getElementById('min-btn')!.addEventListener('click', () => {
    mainThread.minimizeWindow()
  })

  document.getElementById('max-btn')!.addEventListener('click', async () => {
    if (await mainThread.isWindowMaximized()) {
      mainThread.unmaximizeWindow()
    } else {
      mainThread.maximizeWindow()
    }
  })

  document.getElementById('close-btn')!.addEventListener('click', () => {
    mainThread.closeWindow()
  })

  // For Mac inset window
  const sheet = window.document.styleSheets[0]
  if (isMacOS) {
    sheet.insertRule('#navigation { padding-top: 25px !important; }', sheet.cssRules.length)
  }

  if (isMacOS || useSystemMenuBar) {
    // !important is important here because #desktop-title-bar has display: flex.
    sheet.insertRule('#desktop-title-bar { display: none !important; }', sheet.cssRules.length)
  } else {
    /* Use custom title bar. Take the sn-titlebar-height off of
    the app content height so its not overflowing */
    sheet.insertRule('body { padding-top: var(--sn-desktop-titlebar-height); }', sheet.cssRules.length)
    sheet.insertRule(
      `.main-ui-view { height: calc(100vh - var(--sn-desktop-titlebar-height)) !important;
        min-height: calc(100vh - var(--sn-desktop-titlebar-height)) !important; }`,
      sheet.cssRules.length,
    )
  }
}

function registerIpcMessageListener(device: DesktopDevice) {
  window.addEventListener('message', async (event) => {
    // We don't have access to the full file path.
    if (event.origin !== 'file://') {
      return
    }

    let payload
    try {
      payload = JSON.parse(event.data)
    } catch (e) {
      // message doesn't belong to us
      return
    }

    const receiver = window.desktopCommunicationReceiver
    const message = payload.message
    const data = payload.data

    if (message === IpcMessages.WindowBlurred) {
      receiver.windowLostFocus()
    } else if (message === IpcMessages.WindowFocused) {
      receiver.windowGainedFocus()
    } else if (message === IpcMessages.InstallComponentComplete) {
      receiver.onComponentInstallationComplete(data.component, data.error)
    } else if (message === IpcMessages.UpdateAvailable) {
      receiver.updateAvailable()
    } else if (message === IpcMessages.DownloadBackup) {
      device.downloadBackup()
    } else if (message === IpcMessages.FinishedSavingBackup) {
      receiver.didFinishBackup(data.success)
    }
  })
}

async function loadZipLibrary() {
  // load zip library (for exporting items as zip)
  const scriptTag = document.createElement('script')
  scriptTag.src = './vendor/zip/zip.js'
  scriptTag.async = true
  const headTag = document.getElementsByTagName('head')[0]
  headTag.appendChild(scriptTag)
  scriptTag.onload = () => {
    window.zip.workerScriptsPath = './vendor/zip/'
  }
}
