const CracoAlias = require('craco-alias');
const webpack = require('webpack');

module.exports = {
  plugins: [
    {
      plugin: CracoAlias,
      options: {
        source: 'tsconfig',
        // baseUrl SHOULD be specified
        // plugin does not take it from tsconfig
        baseUrl: './src',
        // tsConfigPath should point to the file where "baseUrl" and "paths" are specified
        tsConfigPath: './tsconfig.path.json',
      },
    },
  ],
  webpack: {
    configure: {
      experiments: {
        // https://webpack.js.org/configuration/experiments/
        asyncWebAssembly: true,
      },
      module: {
        rules: [
          {
            test: /\.wasm$/,
            type: 'webassembly/async',
          },
        ],
      },
    },
  },
};
