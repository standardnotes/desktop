const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = (env) =>
  common({
    ...env,
    onlyTranspileTypescript: true,
    experimentalFeatures: true,
  }).map((config) =>
    merge(config, {
      mode: 'development',
      devtool: 'inline-cheap-source-map',
    })
  );
