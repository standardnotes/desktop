const webpack = require('webpack');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = common({ onlyTranspileTypescript: true }).map((config) =>
  merge(config, {
    mode: 'development',
    devtool: 'inline-cheap-source-map',
    plugins: [
      new webpack.DefinePlugin({
        DEFAULT_SYNC_SERVER: JSON.stringify(
          process.env.DEFAULT_SYNC_SERVER ||
            'https://syncing-server-dev.standardnotes.org'
        ),
      }),
    ],
  })
);
