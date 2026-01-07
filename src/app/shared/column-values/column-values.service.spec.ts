import { TestBed } from '@angular/core/testing';
import { ColumnValuesService } from './column-values.service';
import { configureTestingModule } from 'src/test/helpers';
import { ColumnDescription } from '../../types/column.description';
import Resource = fhir.Resource;

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
            code: '2',
            display: 'case'
          }
        ]
      },
      type: 'CodeableConcept',
      result: 'case'
    },
    {
      value: {
        coding: [
          {
            code: '2',
            display: 'case'
          }
        ]
      },
      type: 'CodeableConceptCode',
      result: '2'
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
    },
    {
      value: 42,
      type: 'unsignedInt',
      result: '42'
    },
    {
      value: 0,
      type: 'unsignedInt',
      result: '0'
    },
    {
      value: -42,
      type: 'integer',
      result: '-42'
    },
    {
      value: 0,
      type: 'integer',
      result: '0'
    },
    {
      value: { value: 5 },
      type: 'Count',
      result: '5'
    },
    {
      value: { value: 100, unit: 'items' },
      type: 'Count',
      result: '100 items'
    },
    // CodeableReference with reference
    {
      value: {
        reference: {
          reference: 'Patient/123',
          display: 'John Doe'
        }
      },
      type: 'CodeableReference',
      result: 'John Doe'
    },
    // CodeableReference with concept
    {
      value: {
        concept: {
          coding: [
            {
              code: 'test-code',
              display: 'Test Concept'
            }
          ]
        }
      },
      type: 'CodeableReference',
      fullPath: 'Observation.code',
      result: 'Test Concept'
    },
    // Reference with identifier
    {
      value: {
        identifier: {
          system: 'http://example.org',
          value: 'ID-12345'
        }
      },
      type: 'Reference',
      result: 'ID-12345'
    },
    // Reference with only reference field
    {
      value: {
        reference: 'Practitioner/123'
      },
      type: 'Reference',
      result: 'Practitioner/123'
    },
    // Period with only start
    {
      value: { start: '2024-01-01T00:00:00Z' },
      type: 'Period',
      result: '2024-01-01T00:00:00Z–'
    },
    // Period with only end
    {
      value: { end: '2024-12-31T23:59:59Z' },
      type: 'Period',
      result: '–2024-12-31T23:59:59Z'
    },
    // HumanName with middle initial
    {
      value: {
        family: 'Smith',
        given: ['John', 'Q']
      },
      type: 'HumanName',
      result: 'John Q. Smith'
    },
    // HumanName with only first name
    {
      value: {
        given: ['Jane']
      },
      type: 'HumanName',
      result: 'Jane'
    },
    // HumanName with only last name
    {
      value: {
        family: 'Doe'
      },
      type: 'HumanName',
      result: 'Doe'
    },
    // Address without use
    {
      value: {
        line: ['123 Main St'],
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US'
      },
      type: 'Address',
      result: '123 Main St, Springfield, IL, 62701, US'
    },
    // CodeableConcept with text field
    {
      value: {
        text: 'Custom text value'
      },
      type: 'CodeableConcept',
      result: 'Custom text value'
    }
  ].forEach(({ value, type, fullPath, result }) => {
    it(`should convert a value of ${type} to string`, () => {
      expect(service.valueToStrings([value], type, {} as Resource, {} as ColumnDescription, fullPath)).toEqual([result]);
    });
    it(`should convert an array of ${type} to strings`, () => {
      expect(service.valueToStrings([value, value], type, {} as Resource, {} as ColumnDescription, fullPath)).toEqual([
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
        {} as Resource,
        {} as ColumnDescription,
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
        {} as Resource,
        {} as ColumnDescription,
        ''
      )
    ).toEqual(['display1']);
  });

  it('should return code for CodeableConceptCode', async () => {
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
        'CodeableConceptCode',
        {} as Resource,
        {} as ColumnDescription,
        '',
        undefined
      )
    ).toEqual(['value1']);
  });

  // Edge cases and null handling
  it('should return empty array for null value', () => {
    expect(service.valueToStrings(null, 'string', {} as Resource,
      {} as ColumnDescription, '')).toEqual([]);
  });

  it('should return empty array for empty array value', () => {
    expect(service.valueToStrings([], 'string', {} as Resource,
      {} as ColumnDescription, '')).toEqual([]);
  });

  it('should filter out empty strings from results', () => {
    expect(service.valueToStrings([null, undefined], 'Period',
      {} as Resource, {} as ColumnDescription, '')).toEqual([]);
  });

  it('should handle HumanName with empty values', () => {
    expect(service.valueToStrings([{}], 'HumanName', {} as Resource,
      {} as ColumnDescription, '')).toEqual([]);
  });

  it('should handle Quantity with null value', () => {
    expect(service.valueToStrings([{ value: null }], 'Quantity',
      {} as Resource, {} as ColumnDescription, '')).toEqual([]);
  });

  it('should handle Money with null value', () => {
    expect(service.valueToStrings(
      [{ value: null, currency: 'USD' }], 'Money', {} as Resource,
      {} as ColumnDescription, '')).toEqual([]);
  });

  it('should handle Period with no start or end', () => {
    expect(service.valueToStrings([{}], 'Period', {} as Resource,
      {} as ColumnDescription, '')).toEqual([]);
  });

  it('should handle CodeableConcept with empty coding array', () => {
    expect(service.valueToStrings([{ coding: [] }], 'CodeableConcept',
      {} as Resource, {} as ColumnDescription, '')).toEqual([]);
  });

  it('should handle Reference with no display, reference, or identifier', () => {
    expect(service.valueToStrings([{}], 'Reference', {} as Resource,
      {} as ColumnDescription, '')).toEqual([]);
  });

  it('should handle CodeableReference with no reference or concept', () => {
    expect(service.valueToStrings([{}], 'CodeableReference',
      {} as Resource, {} as ColumnDescription, '')).toEqual([]);
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
        {} as Resource,
        {} as ColumnDescription,
        'ResearchStudy.condition'
      )
    ).toEqual(['value2']);
  });
});
