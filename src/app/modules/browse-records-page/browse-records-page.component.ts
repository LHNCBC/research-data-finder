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
import { getPluralFormOfRecordName } from '../../shared/utils';
import { ResourceTableParentComponent } from '../resource-table-parent.component';
import { HttpContext } from '@angular/common/http';

/**
 * Component for browsing public data (ResearchStudies and Variables).
 */
@Component({
  selector: 'app-browse-records-page',
  templateUrl: './browse-records-page.component.html',
  styleUrls: ['./browse-records-page.component.less']
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
      // MatTable shows sort order icons in reverse (see comment to PR on LF-1905).
      direction: 'desc'
    },
    Variable: {
      active: 'display_name',
      // MatTable shows sort order icons in reverse (see comment to PR on LF-1905).
      direction: 'desc'
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
          this.visibleResourceTypes = fhirBackend.features.hasResearchStudy
            ? this.fhirBackend.isDbgap(this.fhirBackend.serviceBaseUrl)
              ? ['ResearchStudy', 'Variable']
              : // To build Variable list for other FHIR servers we use Observations
                ['ResearchStudy', 'Observation']
            : ['Observation'];
        })
    );
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
        // Dispatching a resize event fixes the issue with <cdk-virtual-scroll-viewport>
        // displaying an empty table when the active tab is changed.
        // This event runs _changeListener in ViewportRuler which run checkViewportSize
        // in CdkVirtualScrollViewport.
        // See code for details:
        // https://github.com/angular/components/blob/12.2.3/src/cdk/scrolling/viewport-ruler.ts#L55
        // https://github.com/angular/components/blob/12.2.3/src/cdk/scrolling/virtual-scroll-viewport.ts#L184
        if (typeof Event === 'function') {
          // fire resize event for modern browsers
          window.dispatchEvent(new Event('resize'));
        } else {
          // for IE and other old browsers
          // causes deprecation warning on modern browsers
          const evt = window.document.createEvent('UIEvents');
          // @ts-ignore
          evt.initUIEvent('resize', true, false, window, 0);
          window.dispatchEvent(evt);
        }
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
      const variableTable = this.tables.find(
        (table) => table.resourceType === 'Variable'
      );
      variableTable?.clearSelection();
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
    this.loadFirstPage(resourceType);
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
   * Loads a list of variables for selected research studies from observations.
   * @param reset - whether to reset already loaded data
   */
  loadVariablesFromObservations(reset = true): void {
    this.selectRecords.loadVariablesFromObservations(
      this.getSelectedRecords('ResearchStudy'),
      {},
      this.variableTable?.filtersForm.value || {},
      this.sort['Observation'],
      reset
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
      this.loadVariablesFromObservations();
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
      this.loadVariablesFromObservations(false);
    } else {
      this.selectRecords.loadNextPage(resourceType);
    }
  }
}
