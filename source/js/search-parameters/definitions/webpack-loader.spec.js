import { getVersionNameByNumber } from '../common-descriptions';

const fs = require('fs')
const loader = require('./webpack-loader');

describe('webpack-loader for R4', function () {
  it('produces same result', function () {
    const data = JSON.parse(loader.call({
        context: __dirname,
        query: require('./webpack-options.json')
      },
      fs.readFileSync(__dirname + '/index.json').toString()));

    // See https://jestjs.io/docs/en/snapshot-testing for details
    ['resources', 'valueSets', 'valueSetByPath', 'valueSetMaps', 'valueSetMapByPath']
      .forEach((prop) =>
        expect(
          data.configByVersionName[getVersionNameByNumber("4.0.0")][prop]
        ).toMatchSnapshot()
      );
  });

  it('matches the version number and name', function () {
    expect(getVersionNameByNumber("4.0.0")).toBe('R4');
    expect(getVersionNameByNumber("4.0.1")).toBe('R4');
    expect(getVersionNameByNumber("4.0.9")).toBe('R4');
  });
});