const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const merge = require('webpack-merge');
const production = require('./webpack.common.js');

module.exports = merge(production, {
  plugins: [
    // It will create an interactive treemap visualization
    // of the contents of all your bundles
    new BundleAnalyzerPlugin(),
  ]
});