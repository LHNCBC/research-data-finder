const path = require('path');

module.exports = (config) => {
  config.module.rules.push(
    {
      test: /definitions\/index.json$/,
      use: [
        {
          loader: path.resolve('../source/js/search-parameters/definitions/webpack-loader.js'),
          options: require(path.resolve('../source/js/search-parameters/definitions/webpack-options.json'))
        }
      ]
    }
  );

  return config;
};
