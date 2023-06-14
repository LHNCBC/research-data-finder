import { TestBed } from '@angular/core/testing';
import { ColumnValuesService } from './column-values.service';
import { configureTestingModule } from 'src/test/helpers';

describe('ColumnValuesService', () => {
  let service: ColumnValuesService;

  beforeEach(async () => {
    await configureTestingModule({});
    service = TestBed.inject(ColumnValuesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  [
    {
      value: { system: '357', value: '00137112900' },
      type: 'Identifier',
      fullPath: 'MedicationDispense.identifier',
      result: '00137112900'
    },
    {
      value: 'finished',
      type: 'code',
      fullPath: 'Encounter.status',
      result: 'Finished'
    },
    {
      value: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'inactive'
          }
        ]
      },
      type: 'CodeableConcept',
      fullPath: 'Condition.clinicalStatus',
      result: 'inactive'
    },
    {
      value: 'enc-106-565200923',
      type: 'string',
      fullPath: 'Encounter.id',
      result: 'enc-106-565200923'
    },
    {
      value: { reference: 'Patient/pat-106', display: 'JIAN MCINTOSH' },
      type: 'Reference',
      fullPath: 'Encounter.subject',
      result: 'JIAN MCINTOSH'
    },
    {
      value: {
        reference: 'Organization/NLM',
        display: 'National Library of Medicine'
      },
      type: 'Reference',
      result: 'NLM'
    },
    {
      value: {
        reference: 'Organization/NIAMS',
        display:
          'National Institute of Arthritis and Musculoskeletal and Skin Diseases'
      },
      type: 'Reference',
      result: 'NIAMS'
    },
    {
      value: { start: '2137-07-12T13:02:59Z', end: '2137-07-12T13:54:00Z' },
      type: 'Period',
      fullPath: 'Encounter.period',
      result: '2137-07-12T13:02:59Z–2137-07-12T13:54:00Z'
    },
    {
      value: '2139-06-19T16:47:00Z',
      type: 'dateTime',
      fullPath: 'Condition.recordedDate',
      result: '2139-06-19T16:47:00Z'
    },
    {
      value: 'url',
      type: 'canonical',
      result: 'url'
    },
    {
      value: 'uri',
      type: 'uri',
      result: 'uri'
    },
    {
      value: {
        system: 'system',
        value: 'value',
        use: 'use'
      },
      type: 'ContactPoint',
      result: 'value'
    },
    {
      value: { value: 1 },
      type: 'Quantity',
      fullPath: 'MedicationDispense.quantity',
      result: '1'
    },
    {
      value: { value: 10, unit: "'cm'" },
      type: 'Quantity',
      fullPath: 'Observation.value',
      result: '10 cm'
    },
    {
      value: { value: 12, unit: 'cm' },
      type: 'Quantity',
      fullPath: 'Observation.value',
      result: '12 cm'
    },
    {
      value: 1.1,
      type: 'decimal',
      result: '1.1'
    },
    {
      value: {
        value: 1.1,
        currency: 'code'
      },
      type: 'Money',
      result: '1.1 code'
    },
    {
      value: true,
      type: 'boolean',
      result: 'true'
    },
    {
      value: false,
      type: 'boolean',
      result: 'false'
    },
    {
      value: '2139-06-19T16:47:00Z',
      type: 'instant',
      result: '2139-06-19T16:47:00Z'
    },
    {
      value: {
        system: 'https://www.hl7.org/fhir/v3/ActCode/cs.html',
        code: 'AMB',
        display: 'ambulatory'
      },
      type: 'Coding',
      fullPath: 'Encounter.class',
      result: 'ambulatory'
    },
    {
      value: {
        value: 10,
        unit: 'ms'
      },
      type: 'Duration',
      result: '10 ms'
    },
    {
      value: '2139-06-19T16:47:00Z',
      type: 'instant',
      result: '2139-06-19T16:47:00Z'
    },
    {
      value: '2139-06-19',
      type: 'date',
      result: '2139-06-19'
    },
    {
      value: {
        family: 'family',
        given: ['first', 'middle']
      },
      type: 'HumanName',
      result: 'first middle family'
    },
    {
      value: {
        use: 'home',
        type: 'both',
        text: '83637 Fake AIRPORT BLVD, CUMBERLAND, MD 21502',
        line: ['83637 Fake AIRPORT BLVD'],
        city: 'CUMBERLAND',
        state: 'MD',
        postalCode: '21502',
        country: 'US'
      },
      type: 'Address',
      result: 'home: 83637 Fake AIRPORT BLVD, CUMBERLAND, MD, 21502, US'
    }
  ].forEach(({ value, type, fullPath, result }) => {
    it(`should convert a value of ${type} to string`, () => {
      expect(service.valueToStrings([value], type, fullPath)).toEqual([result]);
    });
    it(`should convert an array of ${type} to strings`, () => {
      expect(service.valueToStrings([value, value], type, fullPath)).toEqual([
        result,
        result
      ]);
    });
  });

  it('should match pullDataObservationCodes if any', async () => {
    expect(
      service.valueToStrings(
        [
          {
            coding: [
              {
                system: 'system1',
                code: 'value1',
                display: 'display1'
              },
              {
                system: 'system2',
                code: 'value2',
                display: 'display2'
              }
            ]
          }
        ],
        'CodeableConcept',
        '',
        new Map([['value2', 'displayX']])
      )
    ).toEqual(['displayX']);
  });

  it('should use first coding if no pullDataObservationCodes', async () => {
    expect(
      service.valueToStrings(
        [
          {
            coding: [
              {
                system: 'system1',
                code: 'value1',
                display: 'display1'
              },
              {
                system: 'system2',
                code: 'value2',
                display: 'display2'
              }
            ]
          }
        ],
        'CodeableConcept',
        ''
      )
    ).toEqual(['display1']);
  });

  it('should return code for rawCode column', async () => {
    expect(
      service.valueToStrings(
        [
          {
            coding: [
              {
                system: 'system1',
                code: 'value1',
                display: 'display1'
              },
              {
                system: 'system2',
                code: 'value2',
                display: 'display2'
              }
            ]
          }
        ],
        'CodeableConcept',
        '',
        undefined,
        true
      )
    ).toEqual(['value1']);
  });
});

describe('ColumnValuesService', () => {
  let service: ColumnValuesService;

  beforeEach(async () => {
    await configureTestingModule(
      {},
      { serverUrl: 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1' }
    );
    service = TestBed.inject(ColumnValuesService);
  });

  it('should use preferredCodeSystem correctly', async () => {
    expect(
      service.valueToStrings(
        [
          {
            coding: [
              {
                system: 'someCode',
                code: 'value1'
              },
              {
                system: 'urn:oid:2.16.840.1.113883.6.177',
                code: 'value2'
              }
            ]
          }
        ],
        'CodeableConcept',
        'ResearchStudy.condition'
      )
    ).toEqual(['value2']);
  });
});
