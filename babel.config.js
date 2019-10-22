module.exports = function (api) {
  api.cache(true);

  const presets = [
    ["@babel/preset-env", {
      "targets": {
        "node": "current"
      }
    }]
  ];

  const plugins = [
    ["@babel/plugin-transform-regenerator", {
      "asyncGenerators": false,
      "generators": false,
      "async": false
    }],
    "@babel/plugin-transform-async-to-generator"
  ];

  const ignore = [
    "./app/extensions",
    "./app/vendor",
    "./app/compiled",
    "./app/assets",
    "./app/stylesheets",
    "./app/dist",
    "./app/node_modules",
    "./node_modules",
    './package.json',
    "./npm-debug.log"
  ]

  return {
    ignore,
    presets,
    plugins
  };
}
