This application makes use of the core JS/CSS/HTML code found in the [web repo](https://github.com/standardnotes/web). For issues related to the actual app experience, please post issues in the web repo.

## Running Locally

```bash
npm run setup
npm run build:web # Or `npm run dev:web`
npm run dev

# In another terminal
npm start
```

We use [commitlint](https://github.com/conventional-changelog/commitlint) to validate commit messages.
Before making a pull request, make sure to check the output of the following commands:

```bash
npm run lint
npm test # make sure to start `npm run dev` before running the tests
```

Pull requests should target the `develop` branch.

### Installing dependencies

To determine where to install a dependency:

- If it is only required for building, install it in `package.json`'s `devDependencies`
- If it is required at runtime but can be packaged by webpack, install it in `package.json`'s `dependencies`.
- If it must be distributed as a node module (not packaged by webpack), install it in `app/package.json`'s `dependencies`
  - Also make sure to declare it as an external commonjs dependency in `webpack.common.js`.

## Building

Build for all platforms:

- `npm run build`

or

- `npm run build:win`
- `npm run build:linux`
- `npm run build:mac`

## Installation

On Linux, download the latest AppImage from the [Releases](https://github.com/standardnotes/desktop/releases/latest) page, and give it executable permission:

`chmod u+x standard-notes*.AppImage`
