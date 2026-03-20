const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const {
  sanitizeUrlForFilename,
  getBaseDefinitionsCsvPath,
  ensureDefaultDefinitionsCsvFiles,
  getSettingsInitialPath,
  getRdfVersion,
  generateDefinitionsCsv
} = require('./autoconfig');
const { parseCsvString, stringifyCsvRows } = require('./definitions-generator');


class FakeFhirClient {
  constructor(responses = {}, options = {}) {
    this.responses = responses;
    this.features = options.features || { isFormatSupported: false };
    this.queries = [];
  }


  getFeatures() {
    return this.features;
  }


  async get(query) {
    this.queries.push(query);
    if (!(query in this.responses)) {
      throw new Error(`Unexpected fake query: ${query}`);
    }
    const response = this.responses[query];
    if (response instanceof Error) {
      throw response;
    }
    return response;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}


function writeCsv(filePath, rows) {
  fs.writeFileSync(filePath, stringifyCsvRows(rows));
}


function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'autoconfig-test-'));
}


async function runGenerate({
  rows,
  capability,
  clientResponses,
  options = {}
}) {
  const tempDir = createTempDir();
  const definitionsBase = path.join(tempDir, 'definitions.csv');
  writeCsv(definitionsBase, rows);

  let capabilityFile;
  if (capability !== undefined) {
    capabilityFile = path.join(tempDir, 'capability.json');
    writeJson(capabilityFile, capability);
  }

  const fhirClient = new FakeFhirClient(clientResponses || {});
  const definitionsFileName = 'definitions.out.csv';

  const result = await generateDefinitionsCsv({
    url: 'https://example.com/baseR4',
    versionName: 'R4',
    fhirClient,
    outputDir: tempDir,
    options: {
      definitionsBase,
      definitionsFileName,
      ...(capabilityFile ? { capabilityFile } : {}),
      ...options
    }
  });

  const outputCsv = fs.readFileSync(result.outputPath, 'utf-8');
  const outputRows = outputCsv.trim() ? parseCsvString(outputCsv) : [];
  return { result, outputRows, fhirClient, tempDir };
}


test('getSettingsInitialPath resolves the moved conf settings file', () => {
  const settingsPath = getSettingsInitialPath();
  assert.equal(path.basename(settingsPath), 'settings-initial.json5');
  assert.ok(
    settingsPath.includes(`${path.sep}conf${path.sep}settings-initial.json5`)
  );
  assert.ok(fs.existsSync(settingsPath));
});

test('sanitizeUrlForFilename normalizes URL-like strings', () => {
  assert.equal(
    sanitizeUrlForFilename('https://lforms-fhir.nlm.nih.gov/baseR4'),
    'https-lforms-fhir-nlm-nih-gov-baseR4'
  );
  assert.equal(
    sanitizeUrlForFilename('  mixed___chars///and spaces  '),
    'mixed-chars-and-spaces'
  );
  assert.equal(
    sanitizeUrlForFilename('already-safe-Name-123'),
    'already-safe-Name-123'
  );
  assert.equal(sanitizeUrlForFilename('!!!'), '');
});


test('getBaseDefinitionsCsvPath falls back to src/conf/csv when bundled ' +
  'CSV is missing', () => {
  const bundledPath = path.join(
    __dirname,
    'conf',
    'csv',
    'desc-default-R4.csv'
  );
  const backupPath = `${bundledPath}.bak-test`;
  const sourcePath = path.join(
    __dirname,
    '..',
    'src',
    'conf',
    'csv',
    'desc-default-R4.csv'
  );
  const hadBundledFile = fs.existsSync(bundledPath);

  try {
    if (hadBundledFile) {
      fs.renameSync(bundledPath, backupPath);
    }

    const resolvedPath = getBaseDefinitionsCsvPath('R4');
    assert.equal(resolvedPath, sourcePath);
    assert.ok(fs.existsSync(resolvedPath));
  } finally {
    if (hadBundledFile && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, bundledPath);
    }
  }
});


test('getBaseDefinitionsCsvPath prefers bundled autoconfig CSV when present',
  () => {
    const bundledDir = path.join(__dirname, 'conf', 'csv');
    const bundledPath = path.join(bundledDir, 'desc-default-R5.csv');
    const sourcePath = path.join(
      __dirname,
      '..',
      'src',
      'conf',
      'csv',
      'desc-default-R5.csv'
    );
    const hadBundledDir = fs.existsSync(bundledDir);
    const hadBundledFile = fs.existsSync(bundledPath);
    let createdBundledDir = false;
    let createdBundledFile = false;

    try {
      if (!hadBundledDir) {
        fs.mkdirSync(bundledDir, { recursive: true });
        createdBundledDir = true;
      }

      if (!hadBundledFile) {
        fs.writeFileSync(bundledPath, 'resource type,element');
        createdBundledFile = true;
      }

      const resolvedPath = getBaseDefinitionsCsvPath('R5');
      assert.equal(resolvedPath, bundledPath);
      assert.notEqual(resolvedPath, sourcePath);
    } finally {
      if (createdBundledFile && fs.existsSync(bundledPath)) {
        fs.rmSync(bundledPath, { force: true });
      }
      if (createdBundledDir && fs.existsSync(bundledDir)) {
        fs.rmdirSync(bundledDir);
      }
    }
  });

test('ensureDefaultDefinitionsCsvFiles copies missing R4/R5 defaults', () => {
  const outputDir = createTempDir();
  const existingR4Path = path.join(outputDir, 'desc-default-R4.csv');
  fs.writeFileSync(existingR4Path, 'existing-r4-content');

  const copiedPaths = ensureDefaultDefinitionsCsvFiles(outputDir);
  const copiedNames = copiedPaths.map((filePath) => path.basename(filePath));

  assert.deepEqual(copiedNames, ['desc-default-R5.csv']);
  assert.equal(fs.readFileSync(existingR4Path, 'utf-8'), 'existing-r4-content');
  assert.ok(fs.existsSync(path.join(outputDir, 'desc-default-R5.csv')));
});


test('generateDefinitionsCsv excludes unsupported combined params and forces' +
  ' show for constituent params', async () => {
  const definitionsBase = path.join(
    __dirname,
    'fixtures',
    'definitions.combined.csv'
  );
  const capabilityFile = path.join(
    __dirname,
    'fixtures',
    'capability.combined.json'
  );
  const tempDir = createTempDir();
  const fhirClient = new FakeFhirClient({
    'MedicationStatement?_elements=id&_count=1': {
      data: {
        entry: [{ resource: { resourceType: 'MedicationStatement', id: '1' } }]
      }
    },
    'MedicationStatement?_count=1': {
      data: {
        entry: [{
          resource: {
            resourceType: 'MedicationStatement',
            id: 'sample'
          }
        }]
      }
    },
    'MedicationStatement?code:missing=false&_count=5': {
      data: {
        entry: [{
          resource: {
            resourceType: 'MedicationStatement',
            id: 'code-1'
          }
        }]
      }
    }
  });

  const result = await generateDefinitionsCsv({
    url: 'https://example.com/baseR4',
    versionName: 'R4',
    fhirClient,
    outputDir: tempDir,
    options: {
      definitionsBase,
      capabilityFile,
      definitionsFileName: 'definitions.out.csv'
    }
  });

  const rows = parseCsvString(fs.readFileSync(result.outputPath, 'utf-8'));
  const searchParamRows = rows.filter((row) => row?.[2] === 'search parameter');
  const elements = searchParamRows.map((row) => row[1]);
  assert.ok(elements.includes('code'));
  assert.ok(!elements.includes('medication'));
  assert.ok(!elements.includes('code,medication'));

  const codeRow = searchParamRows.find((row) => row[1] === 'code');
  assert.equal(codeRow?.[4], 'show');
});


test('generateDefinitionsCsv keeps combined params when all parts are ' +
  'supported and have data', async () => {
  const rows = [
    ['MedicationStatement', '', '', '', '', '', '', ''],
    ['', 'code', 'search parameter', 'Code', 'hide', 'string', '', ''],
    [
      '',
      'medication',
      'search parameter',
      'Medication',
      'hide',
      'string',
      '',
      ''
    ],
    [
      '',
      'code,medication',
      'search parameter',
      'Code or Medication',
      'hide',
      'string',
      '',
      ''
    ]
  ];
  const capability = {
    rest: [{
      resource: [{
        type: 'MedicationStatement',
        searchParam: [{ name: 'code' }, { name: 'medication' }]
      }]
    }]
  };
  const clientResponses = {
    'MedicationStatement?_elements=id&_count=1': {
      data: {
        entry: [{ resource: { resourceType: 'MedicationStatement', id: 'r1' } }]
      }
    },
    'MedicationStatement?_count=1': {
      data: {
        entry: [{
          resource: {
            resourceType: 'MedicationStatement',
            id: 'sample'
          }
        }]
      }
    },
    'MedicationStatement?code:missing=false&_count=5': {
      data: {
        entry: [{
          resource: {
            resourceType: 'MedicationStatement',
            id: 'code-1'
          }
        }]
      }
    },
    'MedicationStatement?medication:missing=false&_count=5': {
      data: {
        entry: [{
          resource: {
            resourceType: 'MedicationStatement',
            id: 'med-1'
          }
        }]
      }
    }
  };

  const { outputRows } = await runGenerate({
    rows,
    capability,
    clientResponses
  });
  const searchParamRows = outputRows.filter(
    (row) => row?.[2] === 'search parameter'
  );
  const elements = searchParamRows.map((row) => row[1]);

  assert.ok(elements.includes('code,medication'));
  const codeRow = searchParamRows.find((row) => row[1] === 'code');
  assert.equal(codeRow?.[4], 'hide');
});


test('generateDefinitionsCsv excludes resource when capability supports it ' +
  'but no resource data exists', async () => {
  const rows = [
    ['Condition', '', '', '', '', '', '', ''],
    ['', 'code', 'search parameter', 'Code', 'show', 'string', '', '']
  ];
  const capability = {
    rest: [
      { resource: [{ type: 'Condition', searchParam: [{ name: 'code' }] }] }
    ]
  };
  const clientResponses = {
    'Condition?_elements=id&_count=1': { data: { entry: [] } }
  };

  const { outputRows } = await runGenerate({
    rows,
    capability,
    clientResponses
  });
  assert.equal(outputRows.length, 0);
});


test('generateDefinitionsCsv keeps empty columns by default and excludes ' +
  'them with --exclude-empty-columns', async () => {
  const rows = [
    ['Condition', '', '', '', '', '', '', ''],
    ['', 'code', 'search parameter', 'Code', 'show', 'string', '', ''],
    ['', 'id', 'column', 'Id', 'show', 'string', '', ''],
    ['', 'notThere', 'column', 'Not there', 'show', 'string', '', '']
  ];
  const capability = {
    rest: [
      { resource: [{ type: 'Condition', searchParam: [{ name: 'code' }] }] }
    ]
  };
  const clientResponses = {
    'Condition?_elements=id&_count=1': {
      data: { entry: [{ resource: { resourceType: 'Condition', id: 'c1' } }] }
    },
    'Condition?_count=1': {
      data: {
        entry: [{ resource: { resourceType: 'Condition', id: 'sample-c1' } }]
      }
    },
    'Condition?code:missing=false&_count=5': {
      data: {
        entry: [{ resource: { resourceType: 'Condition', id: 'code-c1' } }]
      }
    }
  };

  const defaultResult = await runGenerate({
    rows,
    capability,
    clientResponses
  });
  const defaultColumns = defaultResult.outputRows
    .filter((row) => row?.[2] === 'column')
    .map((row) => row[1]);
  assert.ok(defaultColumns.includes('notThere'));

  const filteredResult = await runGenerate({
    rows,
    capability,
    clientResponses,
    options: { excludeEmptyColumns: true }
  });
  const filteredColumns = filteredResult.outputRows
    .filter((row) => row?.[2] === 'column')
    .map((row) => row[1]);
  assert.ok(!filteredColumns.includes('notThere'));
});


test('generateDefinitionsCsv includes [x] columns when typed choice data ' +
  'exists', async () => {
  const rows = [
    ['Condition', '', '', '', '', '', '', ''],
    ['', 'code', 'search parameter', 'Code', 'show', 'string', '', ''],
    ['', 'abatement[x]', 'column', 'Abatement', 'show', 'string', '', '']
  ];
  const capability = {
    rest: [
      { resource: [{ type: 'Condition', searchParam: [{ name: 'code' }] }] }
    ]
  };
  const clientResponses = {
    'Condition?_elements=id&_count=1': {
      data: { entry: [{ resource: { resourceType: 'Condition', id: 'c1' } }] }
    },
    'Condition?_count=1': {
      data: {
        entry: [{
          resource: {
            resourceType: 'Condition',
            id: 'sample',
            abatementDateTime: '2020-01-01'
          }
        }]
      }
    },
    'Condition?code:missing=false&_count=5': {
      data: {
        entry: [{ resource: { resourceType: 'Condition', id: 'code-c1' } }]
      }
    }
  };

  const { outputRows } = await runGenerate({
    rows,
    capability,
    clientResponses,
    options: { excludeEmptyColumns: true }
  });
  const columnElements = outputRows
    .filter((row) => row?.[2] === 'column')
    .map((row) => row[1]);
  assert.ok(columnElements.includes('abatement[x]'));
});


test('generateDefinitionsCsv excludes reference/Patient search params from ' +
  'output but still uses their data for columns', async () => {
  const rows = [
    ['Observation', '', '', '', '', '', '', ''],
    ['', 'subject', 'search parameter', 'Subject', 'show', 'Patient', '', ''],
    [
      '',
      'subject.display',
      'column',
      'Subject display',
      'show',
      'string',
      '',
      ''
    ]
  ];
  const capability = {
    rest: [
      {
        resource: [{ type: 'Observation', searchParam: [{ name: 'subject' }] }]
      }
    ]
  };
  const clientResponses = {
    'Observation?_elements=id&_count=1': {
      data: { entry: [{ resource: { resourceType: 'Observation', id: 'o1' } }] }
    },
    'Observation?_count=1': {
      data: {
        entry: [{ resource: { resourceType: 'Observation', id: 'sample' } }]
      }
    },
    'Observation?subject:missing=false&_count=5': {
      data: {
        entry: [{
          resource: {
            resourceType: 'Observation',
            id: 'obs-with-subject',
            subject: { display: 'Patient One' }
          }
        }]
      }
    }
  };

  const { outputRows, fhirClient } = await runGenerate({
    rows,
    capability,
    clientResponses,
    options: { excludeEmptyColumns: true }
  });

  const searchParamElements = outputRows
    .filter((row) => row?.[2] === 'search parameter')
    .map((row) => row[1]);
  assert.ok(!searchParamElements.includes('subject'));

  const columnElements = outputRows
    .filter((row) => row?.[2] === 'column')
    .map((row) => row[1]);
  assert.ok(columnElements.includes('subject.display'));
  assert.ok(
    fhirClient.queries.includes('Observation?subject:missing=false&_count=5')
  );
});


test('generateDefinitionsCsv works without a capability file by using ' +
  'metadata fallback + data checks', async () => {
  const rows = [
    ['Condition', '', '', '', '', '', '', ''],
    ['', 'code', 'search parameter', 'Code', 'show', 'string', '', '']
  ];
  const clientResponses = {
    metadata: { data: {} },
    'Condition?_elements=id&_count=1': {
      data: { entry: [{ resource: { resourceType: 'Condition', id: 'c1' } }] }
    },
    'Condition?_count=1': {
      data: {
        entry: [{ resource: { resourceType: 'Condition', id: 'sample' } }]
      }
    },
    'Condition?code:missing=false&_count=5': {
      data: {
        entry: [{ resource: { resourceType: 'Condition', id: 'code-c1' } }]
      }
    }
  };

  const { outputRows, fhirClient } = await runGenerate({
    rows,
    capability: undefined,
    clientResponses
  });

  const resourceRows = outputRows.filter((row) => row?.[0] === 'Condition');
  assert.equal(resourceRows.length, 1);
  assert.ok(fhirClient.queries.includes('metadata'));
});


test('generateDefinitionsCsv prefers sample-resource-dir and skips server ' +
  'sample load when file exists', async () => {
  const rows = [
    ['Condition', '', '', '', '', '', '', ''],
    ['', 'code', 'search parameter', 'Code', 'show', 'string', '', ''],
    ['', 'onsetDateTime', 'column', 'Onset', 'show', 'dateTime', '', '']
  ];
  const capability = {
    rest: [
      { resource: [{ type: 'Condition', searchParam: [{ name: 'code' }] }] }
    ]
  };
  const sampleDir = createTempDir();
  fs.writeFileSync(
    path.join(sampleDir, 'Condition.json'),
    JSON.stringify({
      resourceType: 'Condition',
      id: 'local-sample',
      onsetDateTime: '2022-01-01'
    })
  );

  const clientResponses = {
    'Condition?_elements=id&_count=1': {
      data: { entry: [{ resource: { resourceType: 'Condition', id: 'c1' } }] }
    },
    'Condition?code:missing=false&_count=5': {
      data: {
        entry: [{ resource: { resourceType: 'Condition', id: 'code-c1' } }]
      }
    }
  };

  const { outputRows, fhirClient } = await runGenerate({
    rows,
    capability,
    clientResponses,
    options: {
      excludeEmptyColumns: true,
      sampleResourceDir: sampleDir
    }
  });

  const columnElements = outputRows
    .filter((row) => row?.[2] === 'column')
    .map((row) => row[1]);
  assert.ok(columnElements.includes('onsetDateTime'));
  assert.ok(!fhirClient.queries.includes('Condition?_count=1'));
});


test('getRdfVersion resolves a non-empty RDF version string', () => {
  const rdfVersion = getRdfVersion();
  assert.equal(typeof rdfVersion, 'string');
  assert.ok(rdfVersion.length > 0);
});


test('build-autoconfig writes bundle and support files', async () => {
  const tempBuildDir = createTempDir();

  try {
    childProcess.execFileSync('node', ['autoconfig-src/build-autoconfig.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        AUTOCONFIG_BUILD_DIR: tempBuildDir
      },
      stdio: 'ignore'
    });

    assert.ok(fs.existsSync(path.join(tempBuildDir, 'autoconfig.js')));
    assert.ok(fs.existsSync(path.join(tempBuildDir, 'autoconfig.js.map')));
    assert.ok(fs.existsSync(path.join(tempBuildDir, 'conf', 'build-info.json')));
    assert.ok(fs.existsSync(path.join(
      tempBuildDir,
      'conf',
      'settings-initial.json5'
    )));
    assert.ok(fs.existsSync(path.join(
      tempBuildDir,
      'conf',
      'csv',
      'desc-default-R4.csv'
    )));
    assert.ok(fs.existsSync(path.join(
      tempBuildDir,
      'conf',
      'csv',
      'desc-default-R5.csv'
    )));
  } finally {
    fs.rmSync(tempBuildDir, { recursive: true, force: true });
  }
});
