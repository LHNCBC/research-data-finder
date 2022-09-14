import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewCohortPageComponent } from './view-cohort-page.component';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { of } from 'rxjs';
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { MockComponent } from 'ng-mocks';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatExpansionModule } from '@angular/material/expansion';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { RouterTestingModule } from '@angular/router/testing';

describe('ViewCohortComponent', () => {
  let component: ViewCohortPageComponent;
  let fixture: ComponentFixture<ViewCohortPageComponent>;
  const spies = [];
  spies.push(jasmine.createSpyObj('HttpClient', ['get']));
  spies[0].get.and.returnValue(of({}));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        ViewCohortPageComponent,
        MockComponent(ResourceTableComponent)
      ],
      imports: [
        CommonModule,
        BrowserAnimationsModule,
        MatExpansionModule,
        HttpClientModule,
        RouterTestingModule
      ],
      providers: [
        { provide: HttpClient, useValue: spies[0] },
        {
          provide: ColumnDescriptionsService,
          useValue: {
            getVisibleColumns: () => of([]),
            destroy: () => {}
          }
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewCohortPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
