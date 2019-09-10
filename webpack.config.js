const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');

/**
 *  Returns the hostname without the domain name.
 */
function getShortHostname() {
  let host = require('os').hostname() || 'localhost';
  if (host.indexOf('.') === -1)
    host = host.split('.')[0];
  return host;
}
var shortHostname = getShortHostname();
var port = 4029;

module.exports = {
  entry: './app.js',
  devtool: 'source-map',
  mode: 'development',
  optimization: {
    minimizer: [new TerserJSPlugin({sourceMap: true}), new OptimizeCSSAssetsPlugin({})],
  },
  output: {
    filename: 'app.[contenthash].js',
    path: path.resolve(__dirname, 'public'),
    library: 'app',
    libraryTarget: 'umd'
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html', // under output.path
      template: 'index.html'
    }),
    new MiniCssExtractPlugin({
      filename: 'app.[contenthash].css',
    })
  ],
  module: {
    rules: [
      {
        test: /\.(html)$/,
        use: ['html-loader']
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
         use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[contenthash].[ext]'
            }
          }
        ]
      }
    ]
  },
  devServer: {
    host: '0.0.0.0',
    //host: 'localhost',
    port: port,
    writeToDisk: true, // write generated asset files
    public: shortHostname+':'+port
  }
}
