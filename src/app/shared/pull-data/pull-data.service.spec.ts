import { TestBed } from '@angular/core/testing';

import { PullDataService } from './pull-data.service';
import { SharedModule } from '../shared.module';
import { RouterTestingModule } from '@angular/router/testing';

describe('PullDataService', () => {
  let service: PullDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SharedModule, RouterTestingModule]
    });
    service = TestBed.inject(PullDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });


  describe('combineObservationCodes', () => {
    it('should change duplicate display names', () => {
      expect(
        service.combineObservationCodes([
          {
            coding: [
              {
                code: 'phv00493202.v1.p1',
                system: ''
              }
            ],
            datatype: 'CodeableConcept',
            items: ['Affection status']
          },
          {
            coding: [
              {
                code: 'phv00492021.v1.p1',
                system: ''
              }
            ],
            datatype: 'CodeableConcept',
            items: ['Affection status']
          }
        ])
      ).toEqual({
        coding: [
          {
            code: 'phv00493202.v1.p1',
            system: ''
          },
          {
            code: 'phv00492021.v1.p1',
            system: ''
          }
        ],
        // "datatype" is not used in the pull data step
        datatype: 'any',
        items: ['Affection status | phv00493202.v1.p1', 'Affection status | phv00492021.v1.p1']
      });
    });
  });

});
