This application makes use of the core JS/CSS/HTML code found in the [web repo](https://github.com/standardnotes/web). For issues related to the actual app experience, please post issues in the web repo.

## Running Locally

```bash
npm run setup
npm run dev

# In another terminal
npm start
```

We use [commitlint](https://github.com/conventional-changelog/commitlint) to validate commit messages.
Before making a pull request, make sure to check the output of the following commands:

```bash
npm run lint
npm test
```

Pull requests should target the `dev` branch.

## Building

Build for all platforms:

```bash
electron-packager . "Standard Notes" \
  --platform=all \
  --icon=icon/icon \
  --overwrite \
  --osx-sign='Mac Developer ID Application: xxx' \
  --out=dist
```

or

- `npm run dist`

or

- `npm run dist-win`
- `npm run dist-linux`
- `npm run dist-mac`

## Installation

On Linux, download the latest AppImage from the [Releases](https://github.com/standardnotes/desktop/releases/latest) page, and give it executable permission:

`chmod u+x standard-notes*.AppImage`

## Alternative Downloads

The Standard Notes desktop client is also available through a variety of package managers:

- [unofficial] **AUR:** [standardnotes-desktop](https://aur.archlinux.org/packages/standardnotes-desktop/), non binary package - built from source, currently maintained by [danielhass](https://github.com/danielhass)
