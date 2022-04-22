const { ipcRenderer } = require('electron')
import { IpcMessages } from '../shared/ipcMessages'

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('use-storage-button').addEventListener('click', () => {
    ipcRenderer.send(IpcMessages.UseLocalstorageForKeychain)
  })

  document.getElementById('quit-button').addEventListener('click', () => {
    ipcRenderer.send(IpcMessages.Quit)
  })

  const learnMoreButton = document.getElementById('learn-more')
  learnMoreButton.addEventListener('click', (event) => {
    ipcRenderer.send(IpcMessages.LearnMoreAboutKeychainAccess)
    event.preventDefault()
    const moreInfo = document.getElementById('more-info')
    moreInfo.style.display = 'block'
    learnMoreButton.style.display = 'none'
  })
})
