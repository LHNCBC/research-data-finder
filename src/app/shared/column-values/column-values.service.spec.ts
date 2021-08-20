import { TestBed } from '@angular/core/testing';

import { FhirBatchQuery } from '@legacy/js/common/fhir-batch-query';
import { ColumnValuesService } from './column-values.service';
import { FhirBackendModule } from '../fhir-backend/fhir-backend.module';
import {
  ConnectionStatus,
  FhirBackendService
} from '../fhir-backend/fhir-backend.service';
import { SettingsService } from '../settings-service/settings.service';
import { filter, take } from 'rxjs/operators';

describe('ColumnValuesService', () => {
  let service: ColumnValuesService;
  let fhirBackend: FhirBackendService;

  beforeEach(async () => {
    spyOn(FhirBatchQuery.prototype, 'initialize').and.resolveTo(null);
    spyOn(FhirBatchQuery.prototype, 'getVersionName').and.returnValue('R4');
    TestBed.configureTestingModule({
      imports: [FhirBackendModule]
    });
    fhirBackend = TestBed.inject(FhirBackendService);
    const settingsService = TestBed.inject(SettingsService);
    settingsService.loadJsonConfig().subscribe();
    service = TestBed.inject(ColumnValuesService);
    await fhirBackend.initialized
      .pipe(
        filter((status) => status === ConnectionStatus.Ready),
        take(1)
      )
      .toPromise();
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
      expect(service.valueToStrings([value], type, false, fullPath)).toEqual([
        result
      ]);
    });
    it(`should convert an array of ${type} to strings`, () => {
      expect(
        service.valueToStrings([value, value], type, true, fullPath)
      ).toEqual([result, result]);
    });
  });

  it('should use preferredCodeSystem correctly', async () => {
    spyOnProperty(fhirBackend, 'serviceBaseUrl').and.returnValue(
      'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
    );

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
        true,
        'ResearchStudy.condition'
      )
    ).toEqual(['value2']);
  });
});
