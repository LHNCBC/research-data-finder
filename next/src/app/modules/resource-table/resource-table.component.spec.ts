import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick
} from '@angular/core/testing';
import { ResourceTableComponent } from './resource-table.component';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ResourceTableModule } from './resource-table.module';
import { ColumnDescription } from '../../types/column.description';
import { By } from '@angular/platform-browser';
import { CdkScrollable } from '@angular/cdk/overlay';
import { DebugElement } from '@angular/core';

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
  spies[0].get.and.returnValue(of(bundle));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResourceTableComponent],
      imports: [ResourceTableModule],
      providers: [{ provide: HttpClient, useValue: spies[0] }]
    }).compileComponents();
    fixture = TestBed.createComponent(ResourceTableComponent);
    page = new Page(fixture);
    component = fixture.componentInstance;
    component.enableClientFiltering = true;
    component.columns = [];
    component.columnDescriptions = columnDescriptions;
    component.initialBundle = bundle;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load more rows when scroll', fakeAsync(() => {
    spyOn(component, 'onTableScroll').and.callThrough();
    page.scrollable.nativeElement.scrollTop = 3000;
    const scrollEvent = new MouseEvent('scroll');
    page.scrollable.nativeElement.dispatchEvent(scrollEvent);
    fixture.detectChanges();
    tick(2000);
    fixture.detectChanges();
    expect(component.onTableScroll).toHaveBeenCalled();
    expect(component.dataSource.data.length).toEqual(100);
  }));

  it('should load no more than max rows', fakeAsync(() => {
    spyOn(component, 'onTableScroll').and.callThrough();
    component.max = 50;
    page.scrollable.nativeElement.scrollTop = 3000;
    const scrollEvent = new MouseEvent('scroll');
    page.scrollable.nativeElement.dispatchEvent(scrollEvent);
    fixture.detectChanges();
    tick(2000);
    fixture.detectChanges();
    expect(component.onTableScroll).toHaveBeenCalled();
    expect(component.dataSource.data.length).toEqual(50);
  }));

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
