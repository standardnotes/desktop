import { FileBackupsDevice, FileBackupsMapping } from '@web/Device/DesktopSnjsExports'
import { AppState } from 'app/application'
import { StoreKeys } from '../Store'
import {
  ensureDirectoryExists,
  moveDirContents,
  openDirectoryPicker,
  readJSONFile,
  writeFile,
  writeJSONFile,
} from '../Utils/FileUtils'
import { FileDownloader } from './FileDownloader'
import { shell } from 'electron'

export class FilesBackupManager implements FileBackupsDevice {
  constructor(private appState: AppState) {}

  public isFilesBackupsEnabled(): Promise<boolean> {
    return Promise.resolve(this.appState.store.get(StoreKeys.FileBackupsEnabled))
  }

  public async enableFilesBackups(): Promise<void> {
    this.appState.store.set(StoreKeys.FileBackupsEnabled, true)

    const location = await this.getFilesBackupsLocation()

    if (!location) {
      await this.changeFilesBackupsLocation()
    }

    const mapping = this.getMappingFileFromDisk()

    if (!mapping) {
      await this.saveFilesBackupsMappingFile(this.defaultMappingFileValue())
    }
  }

  public disableFilesBackups(): Promise<void> {
    this.appState.store.set(StoreKeys.FileBackupsEnabled, false)

    return Promise.resolve()
  }

  public async changeFilesBackupsLocation(): Promise<string> {
    const newPath = await openDirectoryPicker()
    const oldPath = await this.getFilesBackupsLocation()

    if (!newPath) {
      return oldPath
    }

    if (oldPath) {
      await moveDirContents(oldPath, newPath)
    }

    this.appState.store.set(StoreKeys.FileBackupsLocation, newPath)

    return newPath
  }

  public getFilesBackupsLocation(): Promise<string> {
    return Promise.resolve(this.appState.store.get(StoreKeys.FileBackupsLocation))
  }

  private getMappingFileLocation(): string {
    const base = this.appState.store.get(StoreKeys.FileBackupsLocation)
    return `${base}/mapping.json`
  }

  private async getMappingFileFromDisk(): Promise<FileBackupsMapping | undefined> {
    return readJSONFile<FileBackupsMapping>(this.getMappingFileLocation())
  }

  private defaultMappingFileValue(): FileBackupsMapping {
    return { files: {} }
  }

  async getFilesBackupsMappingFile(): Promise<FileBackupsMapping> {
    const data = await this.getMappingFileFromDisk()

    if (!data) {
      return this.defaultMappingFileValue()
    }

    return data
  }

  async openFilesBackupsLocation(): Promise<void> {
    const location = await this.getFilesBackupsLocation()

    shell.openPath(location)
  }

  async saveFilesBackupsMappingFile(file: FileBackupsMapping): Promise<'success' | 'failed'> {
    await writeJSONFile(this.getMappingFileLocation(), file)

    return 'success'
  }

  async saveFilesBackupsFile(
    uuid: string,
    metaFile: string,
    downloadRequest: {
      chunkSizes: number[]
      valetToken: string
      url: string
    },
  ): Promise<'success' | 'failed'> {
    const backupsDir = await this.getFilesBackupsLocation()

    const fileDir = `${backupsDir}/${uuid}`
    await ensureDirectoryExists(fileDir)

    const metaFilePath = `${fileDir}/${'metadata.sn.json'}`
    await writeFile(metaFilePath, metaFile)

    const binaryPath = `${fileDir}/file`

    const downloader = new FileDownloader(
      downloadRequest.chunkSizes,
      downloadRequest.valetToken,
      downloadRequest.url,
      binaryPath,
    )

    const result = await downloader.run()

    if (result === 'success') {
      const mapping = await this.getFilesBackupsMappingFile()
      mapping.files[uuid] = {
        path: fileDir,
        backedUpOn: new Date(),
      }
      await this.saveFilesBackupsMappingFile(mapping)
    }

    return result
  }
}
