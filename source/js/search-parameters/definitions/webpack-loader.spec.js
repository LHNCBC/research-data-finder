const fs = require('fs')
const loader = require('./webpack-loader');

describe('webpack-loader for R4', function () {
  it('produce same result', function () {
    const data = JSON.parse(loader.call({
        context: __dirname,
        query: require('./webpack-options.json')
      },
      fs.readFileSync(__dirname + '/index.json').toString()));

    // See https://jestjs.io/docs/en/snapshot-testing for details
    ['resources', 'valueSets', 'valueSetByPath', 'valueSetMaps', 'valueSetMapByPath']
      .forEach(prop => expect(data.configByVersionName[data.versionNameByNumber['4.0.0']][prop]).toMatchSnapshot());
    expect(data.versionNameByNumber['4.0.0']).toBe(data.versionNameByNumber['4.0.1']);
  });
});