const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const moduleConfig = {
  rules: [
    {
      test: /\.(js|ts)$/,
      exclude: /node_modules/,
      loader: 'babel-loader'
    },
    {
      test: /\.(png|html)$/i,
      loader: 'file-loader',
      options: {
        name: '[name].[ext]'
      }
    }
  ]
};

const resolve = {
  extensions: ['.ts', '.js']
};

const electronMainConfig = {
  entry: {
    index: './app/index.ts'
  },
  output: {
    path: path.resolve(__dirname, 'app', 'dist'),
    filename: 'index.js'
  },
  devtool: 'inline-cheap-source-map',
  target: 'electron-main',
  node: {
    __dirname: false
  },
  resolve,
  module: moduleConfig,
  plugins: [
    new CopyPlugin([
      { from: 'app/extensions', to: 'extensions' },
      { from: 'app/vendor', to: 'vendor' },
      {
        from: 'app/node_modules/standard-notes-web/dist',
        to: 'standard-notes-web'
      },
      {
        from: 'app/node_modules/sn-electron-valence',
        to: 'sn-electron-valence'
      },
      { from: 'app/stylesheets/renderer.css', to: 'stylesheets/renderer.css' },
      { from: 'app/icon', to: 'icon' }
    ])
  ]
};

const electronRendererConfig = {
  entry: {
    preload: './app/javascripts/renderer/preload.js',
    renderer: './app/javascripts/renderer/renderer.js'
  },
  output: {
    path: path.resolve(__dirname, 'app', 'dist', 'javascripts', 'renderer')
  },
  target: 'electron-renderer',
  devtool: 'inline-cheap-source-map',
  node: {
    __dirname: false
  },
  resolve,
  module: moduleConfig,
  externals: {
    electron: 'commonjs electron',
    'sn-electron-valence/Transmitter':
      'commonjs sn-electron-valence/Transmitter'
  }
};

module.exports = [electronMainConfig, electronRendererConfig];
