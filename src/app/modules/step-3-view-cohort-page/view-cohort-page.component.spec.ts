import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewCohortPageComponent } from './view-cohort-page.component';
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { of } from 'rxjs';
import {
  ResourceTableComponent
} from '../resource-table/resource-table.component';
import { MockComponent } from 'ng-mocks';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatExpansionModule } from '@angular/material/expansion';
import {
  ColumnDescriptionsService
} from '../../shared/column-descriptions/column-descriptions.service';
import { MatDialogModule } from '@angular/material/dialog';
import { configureTestingModule } from 'src/test/helpers';
import { DistributionConfig } from './cohort-summary/cohort-summary.component';
import { SettingsService } from '../../shared/settings-service/settings.service';

describe('ViewCohortComponent', () => {
  let component: ViewCohortPageComponent;
  let fixture: ComponentFixture<ViewCohortPageComponent>;
  let settingsService: SettingsService;
  let settingsOverrides: { [key: string]: any } = {};

  const spies = [];
  spies.push(jasmine.createSpyObj('HttpClient', ['get']));
  spies[0].get.and.returnValue(of({}));

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [ViewCohortPageComponent, MockComponent(ResourceTableComponent)],
        imports: [CommonModule, NoopAnimationsModule, MatExpansionModule, MatDialogModule],
        providers: [
          { provide: HttpClient, useValue: spies[0] },
          {
            provide: ColumnDescriptionsService,
            useValue: {
              getVisibleColumns: () => of([]),
              destroy: () => {}
            }
          },
          provideHttpClient(withInterceptorsFromDi())
        ]
      },
      { settingsOverrides }
    );
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewCohortPageComponent);
    settingsService = TestBed.inject(SettingsService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load distribution configurations from settings', () => {
    const mockDistributions: DistributionConfig[] = [
      {
        id: 'gender',
        title: 'Gender Distribution',
        fhirPathExpression: 'gender'
      }
    ];

    settingsOverrides['cohortSummary.showByDefault'] = true;
    settingsOverrides['cohortSummary.distributions'] = mockDistributions;

    const newComponent = new ViewCohortPageComponent({} as any, {} as any, settingsService);

    expect(newComponent.showByDefault).toEqual(true);
    expect(newComponent.distributions).toEqual(mockDistributions);
    expect(settingsService.get).toHaveBeenCalledWith('cohortSummary.showByDefault');
    expect(settingsService.get).toHaveBeenCalledWith('cohortSummary.distributions');
  });

  it('should handle missing distribution configuration', () => {
    settingsOverrides['cohortSummary.showByDefault'] = false;
    settingsOverrides['cohortSummary.distributions'] = undefined;

    const newComponent = new ViewCohortPageComponent({} as any, {} as any, settingsService);

    expect(newComponent.showByDefault).toEqual(false);
    expect(newComponent.distributions).toBeUndefined();
  });
});

