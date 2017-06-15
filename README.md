This application makes use of the core JS/CSS/HTML code found in the [web repo](https://github.com/standardnotes/web). For issues related to the actual app experience, please post issues in the web repo.

Build for all platforms:
```
electron-packager . "Standard Notes" --platform=all --icon=icon/icon --overwrite --osx-sign='Mac Developer ID Application: xxx' --out=dist
```

### Linux users: to run an AppImage file, simply:

chmod a+x standard-notes---.AppImage

## License

Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html
