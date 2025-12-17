import { AfterViewInit, Component, OnDestroy, ViewChild } from '@angular/core';
import {
  CACHE_NAME,
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { filter, map, startWith } from 'rxjs/operators';
import { Observable, Subscription } from 'rxjs';
import { MatTabChangeEvent } from '@angular/material/tabs';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import Resource = fhir.Resource;
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { SelectRecordsService } from '../../shared/select-records/select-records.service';
import { Sort } from '@angular/material/sort';
import { dispatchWindowResize, getPluralFormOfRecordName } from '../../shared/utils';
import { ResourceTableParentComponent } from '../resource-table-parent.component';
import { HttpContext } from '@angular/common/http';

/**
 * Component for browsing public data (ResearchStudies and Variables).
 */
@Component({
  selector: 'app-browse-records-page',
  templateUrl: './browse-records-page.component.html',
  styleUrls: ['./browse-records-page.component.less'],
  standalone: false
})
export class BrowseRecordsPageComponent
  extends ResourceTableParentComponent
  implements AfterViewInit, OnDestroy {
  subscriptions: Subscription[] = [];
  @ViewChild('resourceTable') resourceTable: ResourceTableComponent;
  @ViewChild('variableTable') variableTable: ResourceTableComponent;
  hasLoinc = false;
  recTypeLoinc = false;
  showOnlyStudiesWithSubjects = false;

  // The sort state for each resource.
  sort: { [resourceType: string]: Sort } = {
    ResearchStudy: {
      active: 'title',
      direction: 'asc'
    },
    Variable: {
      active: 'display_name',
      direction: 'asc'
    }
  };

  // This observable is used to avoid ExpressionChangedAfterItHasBeenCheckedError
  // when the active tab changes
  currentResourceType$: Observable<string>;

  constructor(
    public fhirBackend: FhirBackendService,
    public columnDescriptions: ColumnDescriptionsService,
    public selectRecords: SelectRecordsService
  ) {
    super();

    this.subscriptions.push(
      fhirBackend.initialized
        .pipe(filter((status) => status === ConnectionStatus.Ready))
        .subscribe(() => {
          selectRecords.resetAll();
          this.visibleResourceTypes = this.hasStudyTab()
            ? this.fhirBackend.isDbgap(this.fhirBackend.serviceBaseUrl)
              ? ['ResearchStudy', 'Variable']
              : // To build Variable list for other FHIR servers we use Observations
                ['ResearchStudy', 'Observation']
            : ['Observation'];
        })
    );
  }

  /**
   * Whether form should have the Study tab
   */
  hasStudyTab(): boolean {
    return this.fhirBackend.features.hasAvailableStudy;
  }

  /**
   * Returns plural form of resource type name.
   */
  getPluralFormOfRecordName = getPluralFormOfRecordName;

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  ngAfterViewInit(): void {
    this.currentResourceType$ = this.tabGroup.selectedTabChange.pipe(
      startWith(this.getCurrentResourceType()),
      map(() => {
        dispatchWindowResize();
        return this.getCurrentResourceType();
      })
    );
    setTimeout(() => {
      this.subscriptions.push(this.currentResourceType$.subscribe());
      const resourceType = this.visibleResourceTypes[0];
      this.loadFirstPage(resourceType);
    });
  }

  /**
   * Handles changing the selected tab.
   * @param event - tab change event
   */
  selectedTabChange(event: MatTabChangeEvent): void {
    const resourceType = this.visibleResourceTypes[event.index];
    if (this.selectRecords.isNeedToReload(resourceType)) {
      this.loadFirstPage(resourceType);
    }
  }

  /**
   * Handles selection change
   * @param resourceType - type of selected resources
   */
  onSelectionChange(resourceType: string): void {
    if (resourceType === 'ResearchStudy') {
      this.selectRecords.resetState('Variable');
      this.selectRecords.resetState('Observation');
    }
  }

  /**
   * Returns selected records of the specified resource type.
   * @param resourceType - resource type
   */
  getSelectedRecords(resourceType: string): Resource[] {
    const resourceTable = this.tables?.find(
      (table) => table.resourceType === resourceType
    );
    return resourceTable?.selectedResources.selected || [];
  }

  /**
   * Handles sort state change.
   * @param resourceType - resource type.
   * @param newSort - new sort description.
   */
  onSortChanged(resourceType: string, newSort: Sort): void {
    this.sort[resourceType] = newSort;
    if (resourceType === 'Observation') {
      this.selectRecords.currentState[resourceType].sortChanged.next(newSort);
    } else {
      this.loadFirstPage(resourceType);
    }
  }

  /**
   * Loads variable records.
   * @param pageNumber - page number to load
   */
  loadVariables(pageNumber = 0): void {
    this.selectRecords.loadVariables(
      this.getSelectedRecords('ResearchStudy'),
      this.recTypeLoinc
        ? {
            rec_type: 'loinc'
          }
        : this.hasLoinc
        ? {
            rec_type: 'dbgv',
            has_loinc: this.hasLoinc
          }
        : {
            rec_type: 'dbgv'
          },
      this.variableTable?.filtersForm.value || {},
      this.sort['Variable'],
      pageNumber
    );
  }

  /**
   * Loads the first page of the specified resource type.
   * @param resourceType - resource type.
   */
  loadFirstPage(resourceType: string): void {
    if (resourceType === 'Variable') {
      this.loadVariables();
    } else if (resourceType === 'Observation') {
      this.selectRecords.loadFirstPageOfVariablesFromObservations(
        this.getSelectedRecords('ResearchStudy'),
        ...this.getParametersToLoadPageOfVariables()
      );
    } else if (resourceType === 'ResearchStudy') {
      const cacheName = 'studies';
      this.selectRecords.loadFirstPage(
        resourceType,
        `$fhir/${resourceType}?_count=3000`,
        {
          context: new HttpContext().set(CACHE_NAME, cacheName)
        }
      );
    } else {
      this.selectRecords.loadFirstPage(
        resourceType,
        `$fhir/${resourceType}?_count=100`,
        {}
      );
    }
  }

  /**
   * Reloads records of the specified resource type from server.
   * @param resourceType - resource type.
   */
  reloadFromServer(resourceType: string): void {
    if (resourceType === 'Variable') {
      this.loadFirstPage(resourceType);
    } else {
      const cacheName = this.showOnlyStudiesWithSubjects ? '' : 'studies';
      this.fhirBackend.clearCacheByName(cacheName).then(() => {
        this.loadFirstPage(resourceType);
      });
    }
  }

  /**
   * Loads the next page of the specified resource type.
   * @param resourceType - resource type.
   */
  loadNextPage(resourceType: string): void {
    if (resourceType === 'Variable') {
      this.loadVariables(
        this.selectRecords.currentState[resourceType].currentPage + 1
      );
    } else if (resourceType === 'Observation') {
      this.selectRecords.loadNextPageOfVariablesFromObservations(
        ...this.getParametersToLoadPageOfVariables()
      );
    } else {
      this.selectRecords.loadNextPage(resourceType);
    }
  }

  /**
   * Preloads the next page of the specified resource type.
   * @param resourceType - resource type.
   */
  preloadNextPage(resourceType: string): void {
    if (resourceType === 'Observation') {
      this.selectRecords.preloadNextPageOfVariablesFromObservations(
        ...this.getParametersToLoadPageOfVariables()
      );
    }
  }

  /**
   * Returns parameters to load a page of variables.
   */
  getParametersToLoadPageOfVariables(): [
    filters: any,
    sort: Sort
  ] {
    return [
      this.variableTable?.filtersForm.value || {},
      this.sort['Observation']
    ];
  }
}
