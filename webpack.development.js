const merge = require('webpack-merge');
const common = require('./webpack.common.js');

/**
 *  Returns the hostname without the domain name.
 */
function getShortHostname() {
  let host = require('os').hostname() || 'localhost';
  if (host.indexOf('.') === -1)
    host = host.split('.')[0];
  return host;
}
const shortHostname = getShortHostname();
const port = 4029;

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './public',
    host: '0.0.0.0',
    //host: 'localhost',
    port: port,
    public: shortHostname+':'+port
  }
});