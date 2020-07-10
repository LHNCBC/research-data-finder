const fs = require('fs')
const loader = require('./webpack-loader');

describe('webpack-loader for R4', function () {
  const dirname = __dirname + '/R4';

  it('produce same result', function () {
    const data = loader.call({
        context: dirname,
        query: require('./webpack-options.json')
      },
      fs.readFileSync(dirname + '/search-parameters.json').toString());

    // See https://jestjs.io/docs/en/snapshot-testing for details
    expect(JSON.parse(data)).toMatchSnapshot();
  });
});