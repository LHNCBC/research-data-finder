import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { map, startWith } from 'rxjs/operators';
import { Observable, Subscription } from 'rxjs';
import { MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import Resource = fhir.Resource;
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { SelectRecordsService } from '../../shared/select-records/select-records.service';
import { Sort } from '@angular/material/sort';
import {
  getPluralFormOfRecordName,
  getPluralFormOfResourceType
} from '../../shared/utils';
import { saveAs } from 'file-saver';

/**
 * Component for browsing public data (ResearchStudies and Variables).
 */
@Component({
  selector: 'app-browse-records-page',
  templateUrl: './browse-records-page.component.html',
  styleUrls: ['./browse-records-page.component.less']
})
export class BrowseRecordsPageComponent
  implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatTabGroup) tabGroup: MatTabGroup;
  @ViewChildren(ResourceTableComponent)
  tables: QueryList<ResourceTableComponent>;
  subscriptions: Subscription[] = [];
  @ViewChild('variableTable') variableTable: ResourceTableComponent;
  @ViewChildren(ResourceTableComponent)
  resourceTables: QueryList<ResourceTableComponent>;
  hasLoinc = false;
  recTypeLoinc = false;

  // Array of visible resource type names
  visibleResourceTypes: string[];
  // Map a resource type to a tab name
  resourceType2TabName = {
    ResearchStudy: 'Study'
  };

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

  // Array of not visible resource type names
  unselectedResourceTypes: string[];
  // This observable is used to avoid ExpressionChangedAfterItHasBeenCheckedError
  // when the active tab changes
  currentResourceType$: Observable<string>;

  constructor(
    public fhirBackend: FhirBackendService,
    public columnDescriptions: ColumnDescriptionsService,
    public selectRecords: SelectRecordsService
  ) {
    selectRecords.resetAll();

    this.subscriptions.push(
      fhirBackend.initialized
        .pipe(map((status) => status === ConnectionStatus.Ready))
        .subscribe((connected) => {
          this.visibleResourceTypes = fhirBackend.features.hasResearchStudy
            ? ['ResearchStudy', 'Variable']
            : ['Observation'];
          this.unselectedResourceTypes = [];
          if (connected) {
            const resources = fhirBackend.getCurrentDefinitions().resources;
            this.unselectedResourceTypes = Object.keys(resources).filter(
              (resourceType) =>
                this.visibleResourceTypes.indexOf(resourceType) === -1
            );
          }
        })
    );
  }

  /**
   * Returns plural form of resource type name.
   */
  getPluralFormOfRecordName = getPluralFormOfRecordName;

  ngOnInit(): void {}

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
   * Returns resourceType for the selected tab
   */
  getCurrentResourceType(): string {
    return this.visibleResourceTypes[this.tabGroup.selectedIndex];
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
   * Returns selected ResearchStudies.
   */
  getSelectedResearchStudies(): Resource[] {
    const researchStudyTable = this.tables.find(
      (table) => table.resourceType === 'ResearchStudy'
    );
    return researchStudyTable?.selectedResources.selected || [];
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
   * Applies the variable table filter change.
   */
  filterVariables(): void {
    // TODO: Currently, user can sort loaded Variable records on
    //       the client-side only. CTSS doesn't support sorting.
    // TODO: Also, CTSS doesn't support paging.
    this.selectRecords.loadVariables(
      this.getSelectedResearchStudies(),
      this.recTypeLoinc
        ? {
            rec_type: 'loinc'
          }
        : {
            rec_type: 'dbgv',
            has_loinc: this.hasLoinc
          },
      this.variableTable?.filtersForm.value || {},
      this.sort['Variable']
    );
  }

  /**
   * Returns the URL parameter for sorting.
   * @param resourceType - resource type.
   */
  getSortParam(resourceType: string): string {
    const sort = this.sort[resourceType];
    if (!sort) {
      return '';
    }
    // MatTable shows sort order icons in reverse (see comment to PR on LF-1905).
    return `_sort=${sort.direction === 'asc' ? '-' : ''}${sort.active}`;
  }

  /**
   * Loads the first page of the specified resource type.
   * @param resourceType - resource type.
   */
  loadFirstPage(resourceType: string): void {
    if (resourceType === 'Variable') {
      this.filterVariables();
    } else {
      const sortParam = this.getSortParam(resourceType);
      // TODO: Currently, user can filter loaded ResearchStudy records on
      //       the client-side only.
      this.selectRecords.loadFirstPage(
        resourceType,
        `$fhir/${resourceType}?_count=50${sortParam ? '&' + sortParam : ''}`
      );
    }
  }

  /**
   * Initiates downloading of resourceTable data in CSV format.
   */
  downloadCsv(): void {
    const currentResourceType = this.getCurrentResourceType();
    const currentResourceTable = this.resourceTables.find(
      (resourceTable) => resourceTable.resourceType === currentResourceType
    );
    saveAs(
      currentResourceTable.getBlob(),
      getPluralFormOfResourceType(currentResourceType).toLowerCase() + '.csv'
    );
  }
}
