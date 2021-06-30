import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResourceTableComponent } from './resource-table.component';
import { of, Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ResourceTableModule } from './resource-table.module';
import { ColumnDescription } from '../../types/column.description';
import { By } from '@angular/platform-browser';
import { CdkScrollable } from '@angular/cdk/overlay';
import { DebugElement, SimpleChange, SimpleChanges } from '@angular/core';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { SharedModule } from '../../shared/shared.module';
import { SettingsService } from '../../shared/settings-service/settings.service';
import Spy = jasmine.Spy;
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';

class Page {
  private fixture: ComponentFixture<ResourceTableComponent>;
  constructor(fixture: ComponentFixture<ResourceTableComponent>) {
    this.fixture = fixture;
  }
  get scrollable(): DebugElement {
    return this.fixture.debugElement.query(By.directive(CdkScrollable));
  }
}

describe('ResourceTableComponent', () => {
  let component: ResourceTableComponent;
  let fixture: ComponentFixture<ResourceTableComponent>;
  let page: Page;

  const bundle = {
    type: undefined,
    link: [{ relation: 'next', url: 'test.url.com' }],
    total: 100,
    entry: []
  };
  for (let i = 1; i < 51; i++) {
    bundle.entry.push({ resource: { id: i.toString() } });
  }
  const availableColumns: ColumnDescription[] = [
    {
      displayName: 'ID',
      element: 'id',
      types: ['string'],
      isArray: false,
      visible: false
    },
    {
      displayName: 'Another column',
      element: 'anotherElement',
      types: ['string'],
      isArray: false,
      visible: false
    },
    {
      displayName: 'Custom column',
      element: 'customElement',
      expression:
        "extension('http://hl7.org/fhir/StructureDefinition/someExtension').value",
      types: ['Count'],
      isArray: false,
      visible: false
    }
  ];
  const hiddenElements = {
    SomeResourceType: ['anotherElement']
  };

  const spies = {
    HttpClient: jasmine.createSpyObj('HttpClient', ['get']),
    ColumnDescriptionsService: jasmine.createSpyObj(
      'ColumnDescriptionsService',
      ['getAvailableColumns']
    ),
    SettingsService: jasmine.createSpyObj('SettingsService', ['get']),
    FhirBackendService: jasmine.createSpyObj('FhirBackendService', [], {
      initialized: of(ConnectionStatus.Ready),
      currentVersion: 'R4'
    })
  };

  spies.HttpClient.get.and.returnValue(of(bundle));
  spies.ColumnDescriptionsService.getAvailableColumns.and.returnValue(
    availableColumns
  );
  spies.SettingsService.get.and.returnValue(hiddenElements);

  async function fillTable(columnDescriptions): Promise<void> {
    component.resourceType = 'SomeResourceType';
    const resourceStream = new Subject();
    component.resourceStream = resourceStream;
    component.columns = [];
    component.columnDescriptions = columnDescriptions;
    const changesObj: SimpleChanges = {
      resourceStream: new SimpleChange(null, resourceStream, true),
      columnDescriptions: new SimpleChange(
        null,
        { columnDescriptions: [] },
        true
      )
    };
    component.ngOnChanges(changesObj);
    for (let i = 1; i < 51; i++) {
      resourceStream.next({
        resourceType: component.resourceType,
        id: i.toString(),
        anotherElement: 'value-' + i.toString(),
        extension: [
          {
            url: 'http://hl7.org/fhir/StructureDefinition/someExtension',
            valueCount: {
              value: i,
              system: 'http://unitsofmeasure.org',
              code: '1'
            }
          }
        ]
      });
    }
    resourceStream.complete();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResourceTableComponent],
      imports: [
        ResourceTableModule,
        SharedModule,
        MatIconTestingModule,
        NoopAnimationsModule
      ],
      providers: [
        { provide: HttpClient, useValue: spies.HttpClient },
        {
          provide: ColumnDescriptionsService,
          useValue: spies.ColumnDescriptionsService
        },
        { provide: SettingsService, useValue: spies.SettingsService },
        { provide: FhirBackendService, useValue: spies.FhirBackendService }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ResourceTableComponent);
    page = new Page(fixture);
    component = fixture.componentInstance;
    component.enableClientFiltering = true;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter', async () => {
    await fillTable(availableColumns);
    expect(component.filtersForm).not.toBeNull();
    expect(component.filterColumns.length).toEqual(availableColumns.length);
    expect(component.filtersForm.get('id')).not.toBeNull();
    expect(component.dataSource.filteredData.length).toEqual(50);
    component.filtersForm.get('id').setValue('49');
    fixture.detectChanges();
    expect(component.dataSource.filteredData.length).toEqual(1);
  });

  it('should hide columns by default according to settings', async () => {
    spyOn(window.localStorage, 'setItem');
    await fillTable([]);
    expect(component.filterColumns.length).toEqual(availableColumns.length - 1);
    expect(component.dataSource.filteredData.length).toEqual(50);
    expect(
      (window.localStorage.setItem as Spy).calls.mostRecent().args[0]
    ).toEqual('SomeResourceType-columns');
    expect(
      (window.localStorage.setItem as Spy).calls.mostRecent().args[1]
    ).toEqual('id,customElement');
  });

  it('should get a cell strings correctly', async () => {
    await fillTable(availableColumns);
    const rowNumber = 6;
    const cellValues = ['5', 'value-5', '5'];
    for (let i = 0; cellValues.length < 3; i++) {
      expect(
        component.getCellStrings(
          component.dataSource.data[rowNumber],
          component.columnDescriptions[i]
        )
      ).toEqual([cellValues[i]]);
    }
  });
});
