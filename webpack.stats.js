const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const merge = require('webpack-merge');
const production = require('./webpack.common.js');

module.exports = merge(production, {
  plugins: [
    new BundleAnalyzerPlugin(),
  ]
});