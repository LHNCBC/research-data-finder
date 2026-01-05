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

  const spies = [];
  spies.push(jasmine.createSpyObj('HttpClient', ['get']));
  spies[0].get.and.returnValue(of({}));

  async function setupTest(settingsOverrides: { [key: string]: any } = {}) {
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

    fixture = TestBed.createComponent(ViewCohortPageComponent);
    settingsService = TestBed.inject(SettingsService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', async () => {
    await setupTest();
    expect(component).toBeTruthy();
  });

  it('should load distribution configurations from settings', async () => {
    const mockDistributions: DistributionConfig[] = [
      {
        id: 'gender',
        title: 'Gender Distribution',
        fhirPathExpression: 'gender'
      }
    ];

    const settingsOverrides = {
      'cohortSummary.showByDefault': true,
      'cohortSummary.distributions': mockDistributions
    };

    await setupTest(settingsOverrides);

    expect(component.showByDefault).toEqual(true);
    expect(component.distributions).toEqual(mockDistributions);
    expect(settingsService.get).toHaveBeenCalledWith('cohortSummary.showByDefault');
    expect(settingsService.get).toHaveBeenCalledWith('cohortSummary.distributions');
  });

  it('should handle missing distribution configuration', async () => {
    const settingsOverrides = {
      'cohortSummary.showByDefault': undefined,
      'cohortSummary.distributions': undefined
    };

    await setupTest(settingsOverrides);

    expect(component.showByDefault).toEqual(false);
    expect(component.distributions).toBeUndefined();
  });
});
