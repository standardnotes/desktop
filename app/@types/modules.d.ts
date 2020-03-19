declare module "electron-editor-context-menu" {
    export default function buildEditorContextMenu(options: {
      isMisspelled: boolean,
      spellingSuggestions: string[]
    }): Electron.Menu
}
