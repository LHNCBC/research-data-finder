import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResourceTableComponent } from './resource-table.component';
import {of} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ResourceTableModule} from './resource-table.module';
import {ColumnDescription} from '../../types/column.description';

describe('ResourceTableComponent', () => {
  let component: ResourceTableComponent;
  let fixture: ComponentFixture<ResourceTableComponent>;

  const bundle = {
    type: undefined,
    link: [
      { relation: 'next', url: '' }
    ],
    total: 100,
    entry: []
  };
  const columnDescriptions: ColumnDescription[] = [
    {
      displayName: 'ID',
      element: 'id',
      types: ['string'],
      isArray: false,
      visible: false
    }
  ];

  beforeEach(async () => {
    const spies = [];
    spies.push(jasmine.createSpyObj('HttpClient', ['get']));
    spies[0].get.and.returnValue(of(bundle));

    await TestBed.configureTestingModule({
      declarations: [ ResourceTableComponent ],
      imports: [
        ResourceTableModule
      ],
      providers: [
        { provide: HttpClient, useValue: spies[0] }
      ]
    })
    .compileComponents();
    fixture = TestBed.createComponent(ResourceTableComponent);
    component = fixture.componentInstance;
    component.columns = [];
    component.columnDescriptions = columnDescriptions;
    component.initialBundle = bundle;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
