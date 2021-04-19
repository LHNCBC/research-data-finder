import { TestBed } from '@angular/core/testing';

import { ColumnDescriptionsService } from './column-descriptions.service';
import { MatDialog } from '@angular/material/dialog';
import {
  ConnectionStatus,
  FhirBackendService
} from '../fhir-backend/fhir-backend.service';
import { BehaviorSubject } from 'rxjs';

describe('ColumnDescriptionsService', () => {
  let service: ColumnDescriptionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: {} },
        {
          provide: FhirBackendService,
          useValue: {
            initialized: new BehaviorSubject(ConnectionStatus.Ready),
            getColumns: () => [
              {
                displayName: 'ID',
                element: 'id',
                types: ['string'],
                isArray: false,
                visible: false
              },
              {
                displayName: 'Name',
                element: 'name',
                types: ['string'],
                isArray: false,
                visible: true
              }
            ]
          }
        },
        ColumnDescriptionsService
      ]
    });
    service = TestBed.inject(ColumnDescriptionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get columns', (done) => {
    service.getVisibleColumns('Patient').subscribe((visibleColumns) => {
      expect(visibleColumns.length).toEqual(1);
      done();
    });
  });
});
