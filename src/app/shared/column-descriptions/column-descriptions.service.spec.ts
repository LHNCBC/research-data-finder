import { TestBed } from '@angular/core/testing';

import { ColumnDescriptionsService } from './column-descriptions.service';
import { MatDialog } from '@angular/material/dialog';
import {
  ConnectionStatus,
  FhirBackendService
} from '../fhir-backend/fhir-backend.service';
import { BehaviorSubject } from 'rxjs';
import { SharedModule } from '../shared.module';

describe('ColumnDescriptionsService', () => {
  let service: ColumnDescriptionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SharedModule],
      providers: [
        { provide: MatDialog, useValue: {} },
        {
          provide: FhirBackendService,
          useValue: {
            initialized: new BehaviorSubject(ConnectionStatus.Ready),
            serviceBaseUrl: 'someUrl',
            getCurrentDefinitions: () => ({
              resources: {
                Patient: {
                  columnDescriptions: [
                    {
                      element: 'id',
                      types: ['string'],
                      isArray: false
                    },
                    {
                      element: 'name',
                      types: ['string'],
                      isArray: false
                    }
                  ]
                }
              }
            })
          }
        },
        ColumnDescriptionsService
      ]
    });
    spyOn(window.localStorage, 'getItem').and.callFake((paramName) => {
      if (paramName === 'someUrl-Patient-columns') {
        return 'name';
      }
      return '';
    });
    service = TestBed.inject(ColumnDescriptionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get columns', (done) => {
    service.getVisibleColumns('Patient').subscribe((visibleColumns) => {
      expect(visibleColumns).toEqual([
        jasmine.objectContaining({ displayName: 'Name' })
      ]);
      done();
    });
  });
});
