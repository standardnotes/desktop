This application makes use of the core JS/CSS/HTML code found in the [web repo](https://github.com/standardnotes/web). For issues related to the actual app experience, please post issues in the web repo.

## Building

Build for all platforms:
```
electron-packager . "Standard Notes" \
  --platform=all \
  --icon=icon/icon \
  --overwrite \
  --osx-sign='Mac Developer ID Application: xxx' \
  --out=dist
```

## Installation

On Linux, download the latest AppImage from the [Releases](https://github.com/standardnotes/desktop/releases/latest) page, and give it executable permission:

`chmod u+x standard-notes*.AppImage`

## Alternative Downloads

The Standard Notes desktop client is also available through a variety of package managers:

* [unofficial] **AUR:** [sn-bin](https://aur.archlinux.org/packages/sn-bin/), currently maintained by [JoshuaRLi](https://github.com/JoshuaRLi)
