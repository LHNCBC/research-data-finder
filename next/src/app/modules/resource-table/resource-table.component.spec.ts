import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick
} from '@angular/core/testing';
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
  const columnDescriptions: ColumnDescription[] = [
    {
      displayName: 'ID',
      element: 'id',
      types: ['string'],
      isArray: false,
      visible: false
    }
  ];

  const spies = [];
  spies.push(jasmine.createSpyObj('HttpClient', ['get']));
  spies.push(
    jasmine.createSpyObj('ColumnDescriptionsService', ['getAvailableColumns'])
  );
  spies[0].get.and.returnValue(of(bundle));
  spies[1].getAvailableColumns.and.returnValue(columnDescriptions);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResourceTableComponent],
      imports: [ResourceTableModule, SharedModule],
      providers: [
        { provide: HttpClient, useValue: spies[0] },
        { provide: ColumnDescriptionsService, useValue: spies[1] }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ResourceTableComponent);
    page = new Page(fixture);
    component = fixture.componentInstance;
    component.enableClientFiltering = true;
    component.columns = [];
    component.columnDescriptions = columnDescriptions;
    const patientStream = new Subject();
    component.resourceStream = patientStream;
    const changesObj: SimpleChanges = {
      patientStream: new SimpleChange(null, patientStream, true),
      columnDescriptions: new SimpleChange(null, { columnDescriptions }, true)
    };
    component.ngOnChanges(changesObj);
    for (let i = 1; i < 51; i++) {
      patientStream.next({ id: i.toString() });
    }
    patientStream.complete();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter', () => {
    expect(component.filtersForm).not.toBeNull();
    expect(component.filterColumns.length).toEqual(1);
    expect(component.filtersForm.get('id')).not.toBeNull();
    expect(component.dataSource.filteredData.length).toEqual(50);
    component.filtersForm.get('id').setValue('49');
    fixture.detectChanges();
    expect(component.dataSource.filteredData.length).toEqual(1);
  });
});
