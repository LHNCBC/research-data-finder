import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResourceTableComponent } from './resource-table.component';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ResourceTableModule } from './resource-table.module';
import { ColumnDescription } from '../../types/column.description';
import { By } from '@angular/platform-browser';
import { CdkScrollable } from '@angular/cdk/overlay';
import { DebugElement, SimpleChange, SimpleChanges } from '@angular/core';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { SharedModule } from '../../shared/shared.module';
import { SettingsService } from '../../shared/settings-service/settings.service';
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
  get filterIcons(): DebugElement[] {
    return this.fixture.debugElement.queryAll(By.css('th button mat-icon'));
  }
  get clearFiltersLink(): DebugElement {
    return this.fixture.debugElement.query(By.css('#clearFilters'));
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
      visible: false,
      displayByDefault: true
    },
    {
      displayName: 'Another column',
      element: 'anotherElement',
      types: ['string'],
      isArray: false,
      visible: false
    },
    {
      displayName: 'Number of Analyses',
      element: 'customElement',
      expression: `extension('http://hl7.org/fhir/StructureDefinition/someExtension').value`,
      types: ['Count'],
      isArray: false,
      visible: false,
      displayByDefault: true
    }
  ];
  const hiddenElements = {
    SomeResourceType: ['anotherElement']
  };

  const spies = {
    HttpClient: jasmine.createSpyObj('HttpClient', ['get']),
    ColumnDescriptionsService: jasmine.createSpyObj(
      'ColumnDescriptionsService',
      ['getAvailableColumns', 'setVisibleColumnNames', 'setColumnsWithData']
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
  spies.SettingsService.get
    .withArgs('hideElementsByDefault')
    .and.returnValue(hiddenElements);
  spies.SettingsService.get.withArgs('listFilterColumns').and.returnValue([]);

  function fillTable(columnDescriptions): void {
    component.resourceType = 'SomeResourceType';
    const resources = [];
    component.resources = resources;
    component.columns = [];
    component.columnDescriptions = columnDescriptions;
    const changesObj: SimpleChanges = {
      resources: new SimpleChange(null, resources, true),
      columnDescriptions: new SimpleChange(
        null,
        { columnDescriptions: [] },
        true
      )
    };
    for (let i = 1; i < 51; i++) {
      resources.push({
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
    component.ngOnChanges(changesObj);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
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
    component.enableFiltering = true;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show filter icons', () => {
    fillTable(availableColumns);
    expect(page.filterIcons).not.toBeNull();
    expect(page.filterIcons.length).toEqual(3);
  });

  it('should filter', () => {
    fillTable(availableColumns);
    expect(component.filtersForm).not.toBeNull();
    expect(component.filtersForm.get('id')).not.toBeNull();
    expect(component.dataSource.filteredData.length).toEqual(50);
    component.filtersForm.get('id').setValue('49');
    fixture.detectChanges();
    expect(component.dataSource.filteredData.length).toEqual(1);
  });

  it('should hide columns by default according to settings', () => {
    spies.ColumnDescriptionsService.getAvailableColumns.calls.reset();
    fillTable([]);
    expect(component.dataSource.filteredData.length).toEqual(50);
    expect(
      spies.ColumnDescriptionsService.getAvailableColumns
    ).toHaveBeenCalledOnceWith('SomeResourceType', '');
  });

  it('should get a cell strings correctly', () => {
    fillTable(availableColumns);
    const rowNumber = 4;
    const cellValues = ['5', 'value-5', '5'];
    for (let i = 0; i < cellValues.length; i++) {
      expect(
        component.getCellStrings(
          component.dataSource.data[rowNumber].resource,
          component.columnDescriptions[i]
        )
      ).toEqual([cellValues[i]]);
    }
  });

  it('should show selectable rows at beginning of table', () => {
    component.myStudyIds = ['30'];
    fillTable(availableColumns);
    const firstRow = component.dataSource.data[0].resource;
    expect(firstRow.id).toEqual('30');
  });

  it('should filter number column - greater than', () => {
    fillTable(availableColumns);
    expect(component.filtersForm).not.toBeNull();
    expect(component.filtersForm.get('customElement')).not.toBeNull();
    expect(component.dataSource.filteredData.length).toEqual(50);
    component.filtersForm.get('customElement').setValue('>=49');
    fixture.detectChanges();
    expect(component.dataSource.filteredData.length).toEqual(2);
  });

  it('should filter number column - smaller than', () => {
    fillTable(availableColumns);
    expect(component.filtersForm).not.toBeNull();
    expect(component.filtersForm.get('customElement')).not.toBeNull();
    expect(component.dataSource.filteredData.length).toEqual(50);
    component.filtersForm.get('customElement').setValue('<49');
    fixture.detectChanges();
    expect(component.dataSource.filteredData.length).toEqual(48);
  });

  it('should filter number column - range', () => {
    fillTable(availableColumns);
    expect(component.filtersForm).not.toBeNull();
    expect(component.filtersForm.get('customElement')).not.toBeNull();
    expect(component.dataSource.filteredData.length).toEqual(50);
    component.filtersForm.get('customElement').setValue('40 - 49');
    fixture.detectChanges();
    expect(component.dataSource.filteredData.length).toEqual(10);
  });

  it('should filter numbers', () => {
    expect(ResourceTableComponent.checkNumberFilter('10', '>3')).toBeTrue();
    expect(ResourceTableComponent.checkNumberFilter('10', '<3')).toBeFalse();
    expect(ResourceTableComponent.checkNumberFilter('10', '>=3')).toBeTrue();
    expect(ResourceTableComponent.checkNumberFilter('10', '<=10')).toBeTrue();
    expect(ResourceTableComponent.checkNumberFilter('10', '10')).toBeTrue();
    expect(ResourceTableComponent.checkNumberFilter('10', '3 - 7')).toBeFalse();
    expect(ResourceTableComponent.checkNumberFilter('10', '3 - 13')).toBeTrue();
  });

  it('should sort number column as numbers', () => {
    fillTable(availableColumns);
    component.sortData({
      direction: 'asc',
      active: 'customElement'
    });
    const index50 = component.dataSource.data.findIndex(
      (x) => x.resource.id === '50'
    );
    const index12 = component.dataSource.data.findIndex(
      (x) => x.resource.id === '12'
    );
    const index9 = component.dataSource.data.findIndex(
      (x) => x.resource.id === '9'
    );
    expect(index50 < index12).toBeTrue();
    expect(index12 < index9).toBeTrue();
  });

  it('should show message when no records match filter', () => {
    fillTable(availableColumns);
    expect(component.filtersForm).not.toBeNull();
    expect(component.filtersForm.get('id')).not.toBeNull();
    expect(component.dataSource.filteredData.length).toEqual(50);
    expect(page.clearFiltersLink).toBeNull();
    component.filtersForm.get('id').setValue('51');
    fixture.detectChanges();
    expect(component.dataSource.filteredData.length).toEqual(0);
    expect(page.clearFiltersLink).not.toBeNull();
  });
});
