import { TestBed } from '@angular/core/testing';

import { CartService } from './cart.service';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import variableList from 'src/test/test-fixtures/variable-list.json';
import {
  configureTestingModule,
  verifyOutstandingRequests
} from '../../../test/helpers';
import { SharedModule } from '../shared.module';
import { RouterTestingModule } from '@angular/router/testing';

describe('CartService', () => {
  let mockHttp: HttpTestingController;
  let service: CartService;

  beforeEach(async () => {
    await configureTestingModule({
      imports: [SharedModule, HttpClientTestingModule, RouterTestingModule]
    });
    mockHttp = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CartService);
  });

  afterEach(() => {
    // Verify that no unmatched requests are outstanding
    verifyOutstandingRequests(mockHttp);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should group/ungroup list items', () => {
    service.addRecords('Variable', variableList);
    mockHttp
      .expectOne('$fhir/Observation?_count=1&combo-code=phv00492021.v1.p1')
      .flush({
        entry: [
          {
            resource: {
              valueCodeableConcept: {
                coding: [
                  {
                    system:
                      'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/CodeSystem/DbGaP-Phenotype-Variable-phv00492021',
                    code: '2',
                    display: 'case'
                  }
                ]
              }
            }
          }
        ]
      });
    mockHttp
      .expectOne('$fhir/Observation?_count=1&combo-code=phv00492022.v1.p1')
      .flush({
        entry: [
          {
            resource: {
              valueCodeableConcept: {
                coding: [
                  {
                    system:
                      'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/CodeSystem/DbGaP-Phenotype-Variable-phv00492022',
                    code: '2',
                    display: 'case'
                  }
                ]
              }
            }
          }
        ]
      });
    mockHttp
      .expectOne('$fhir/Observation?_count=1&combo-code=phv00492024.v1.p1')
      .flush({
        entry: [
          {
            resource: {
              valueQuantity: {
                value: 7.1,
                unit: 'years',
                system: 'http://unitsofmeasure.org',
                code: 'a'
              }
            }
          }
        ]
      });
    mockHttp
      .expectOne('$fhir/Observation?_count=1&combo-code=phv00492067.v1.p1')
      .flush({
        entry: [
          {
            resource: {
              valueQuantity: {
                value: 240.76923077,
                unit: 'liters/minute',
                system: 'http://unitsofmeasure.org',
                code: 'L/min'
              }
            }
          }
        ]
      });
    mockHttp
      .expectOne('$fhir/Observation?_count=1&combo-code=phv00492069.v1.p1')
      .flush({
        entry: [
          {
            resource: {
              valueQuantity: {
                value: 0.3181818182,
                unit:
                  'Units were not extracted correctly in this release. We will extract them in the next release.',
                system: 'http://unitsofmeasure.org'
              }
            }
          }
        ]
      });
    mockHttp
      .expectOne('$fhir/Observation?_count=1&combo-code=phv00492063.v1.p1')
      .flush({
        entry: [
          {
            resource: {
              valueQuantity: {
                value: 449,
                unit:
                  'Units were not extracted correctly in this release. We will extract them in the next release.',
                system: 'http://unitsofmeasure.org'
              }
            }
          }
        ]
      });
    mockHttp
      .expectOne('$fhir/Observation?_count=1&combo-code=phv00492029.v1.p1')
      .flush({
        entry: [
          {
            resource: {
              valueQuantity: {
                value: -0.57,
                unit:
                  'Units were not extracted correctly in this release. We will extract them in the next release.',
                system: 'http://unitsofmeasure.org'
              }
            }
          }
        ]
      });
    expect(service.getListItems('Variable').length).toBe(7);
    service.groupItems('Variable', new Set(variableList));
    expect(service.getListItems('Variable').length).toBe(2);
    service.ungroupItems('Variable', new Set(variableList));
    expect(service.getListItems('Variable').length).toBe(7);
  });
});
