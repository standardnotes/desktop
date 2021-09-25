# Standard Notes

<div align="center">

[![latest release version](https://img.shields.io/github/v/release/standardnotes/desktop)](https://github.com/standardnotes/desktop/releases)
[![License](https://img.shields.io/github/license/standardnotes/desktop?color=blue)](https://github.com/standardnotes/desktop/blob/master/LICENSE)
[![Slack](https://img.shields.io/badge/slack-standardnotes-CC2B5E.svg?style=flat&logo=slack)](https://standardnotes.org/slack)
[![Twitter Follow](https://img.shields.io/badge/follow-%40standardnotes-blue.svg?style=flat&logo=twitter)](https://twitter.com/standardnotes)

</div>

This application makes use of the core JS/CSS/HTML code found in the [web repo](https://github.com/standardnotes/web). For issues related to the actual app experience, please post issues in the web repo.

## Running Locally

Make sure [Yarn](https://classic.yarnpkg.com/en/) is installed on your system.

```bash
yarn setup
yarn build:web # Or `yarn dev:web`
yarn dev

# In another terminal
yarn start
```

We use [commitlint](https://github.com/conventional-changelog/commitlint) to validate commit messages.
Before making a pull request, make sure to check the output of the following commands:

```bash
yarn lint
yarn test # make sure to start `yarn dev` before running the tests
```

Pull requests should target the `develop` branch.

### Installing dependencies

To determine where to install a dependency:

- If it is only required for building, install it in `package.json`'s `devDependencies`
- If it is required at runtime but can be packaged by webpack, install it in `package.json`'s `dependencies`.
- If it must be distributed as a node module (not packaged by webpack), install it in `app/package.json`'s `dependencies`
  - Also make sure to declare it as an external commonjs dependency in `webpack.common.js`.

## Building

### Amd64

Build for all platforms:

- `yarn build:all`

or

- `yarn build appimage`
- `yarn build mac`
- `yarn build snap`
- `yarn build windows`

### Arm64

Building on amd64 machines is only possible with AppImage, Debian and universal "dir" targets.

`npm_config_target_arch=arm64` needs to be set as an environment variable before building (eg. with `export npm_config_target_arch=arm64`).

The required steps are, mostly analogous to the regular build / run process:

- `yarn setup`
- `yarn bundle:arm64`

Followed by any or all of the following:

- `yarn build:dir:arm64`
- `yarn build:appimage:arm64`
- `yarn build:deb:arm64`

Building snap releases (or natively building the other release types natively on an arm64machine) requires some extra preparation.

- `export npm_config_target_arch=arm64`
- `export npm_config_arch=arm64`

A native `fpm` installation is needed for Debian builds. `fpm` needs to be available in `$PATH`, which can be achieved by running

- `gem install fpm --no-document`

and making sure `$GEM_HOME/bin` is added to `$PATH`.

Snap releases also require a working snapcraft / `snapd` installation.

Building then follows the same steps as above:

- `yarn setup`
- `yarn bundle:arm64`

Then followed by either:

- `yarn build:all:arm64`

Or the individual commands:

- `yarn build:dir:arm64`
- `yarn build:appimage:arm64`
- `yarn build:deb:arm64`
- `yarn build:snap:arm64`

## Installation

On Linux, download the latest AppImage from the [Releases](https://github.com/standardnotes/desktop/releases/latest) page, and give it executable permission:

`chmod u+x standard-notes*.AppImage`
