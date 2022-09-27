import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { filter, map, startWith } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import Resource = fhir.Resource;
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { SelectRecordsService } from '../../shared/select-records/select-records.service';
import { Sort } from '@angular/material/sort';
import { CartService, ListItem } from '../../shared/cart/cart.service';
import { getPluralFormOfRecordName, getRecordName } from '../../shared/utils';
import { ErrorManager } from '../../shared/error-manager/error-manager.service';
import { ErrorStateMatcher } from '@angular/material/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Component for searching, selecting, and adding records to the cart.
 */
@Component({
  selector: 'app-select-records-page',
  templateUrl: './select-records-page.component.html',
  styleUrls: ['./select-records-page.component.less'],
  providers: [
    ErrorManager,
    {
      provide: ErrorStateMatcher,
      useExisting: ErrorManager
    }
  ]
})
export class SelectRecordsPageComponent
  implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatTabGroup) tabGroup: MatTabGroup;
  @ViewChildren(ResourceTableComponent)
  tables: QueryList<ResourceTableComponent>;
  subscriptions: Subscription[] = [];
  @ViewChild('variableTable') variableTable: ResourceTableComponent;
  maxPatientsNumber = new FormControl('100', Validators.required);
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

  constructor(
    public fhirBackend: FhirBackendService,
    public columnDescriptions: ColumnDescriptionsService,
    public selectRecords: SelectRecordsService,
    private liveAnnouncer: LiveAnnouncer,
    public cart: CartService
  ) {
    selectRecords.resetAll();

    this.subscriptions.push(
      fhirBackend.initialized
        .pipe(filter((status) => status === ConnectionStatus.Ready))
        .subscribe(() => {
          this.cart.reset();
          this.visibleResourceTypes = fhirBackend.features.hasResearchStudy
            ? ['ResearchStudy', 'Variable']
            : ['Observation'];
        })
    );
  }

  getPluralFormOfRecordName = getPluralFormOfRecordName;

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.subscriptions.push(
        this.tabGroup.selectedTabChange
          .pipe(
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
          )
          .subscribe()
      );

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
  onSelectionChange(resourceType: string): void {}

  /**
   * Adds records of the specified resource type to the card.
   * @param resourceType - resource type
   * @param resources - records to add
   */
  addRecordsToCart(resourceType, resources: Resource[]): void {
    this.cart.addRecords(resourceType, resources);
    this.clearSelectedRecords(resourceType);
    if (resourceType === 'ResearchStudy') {
      this.selectRecords.resetState('Variable');
      this.clearSelectedRecords('Variable');
    }
    this.liveAnnouncer.announce(
      'Added selected variables to the cart area below.'
    );
  }

  /**
   * Removes record from the cart.
   * @param resourceType - resource type
   * @param listItem - list item, this can be a record or a group (array)
   *   of records.
   */
  removeRecordFromCart(resourceType: string, listItem: ListItem): void {
    this.cart.removeRecords(resourceType, [listItem]);
    if (resourceType === 'ResearchStudy') {
      this.selectRecords.resetState('Variable');
      this.clearSelectedRecords('Variable');
    }
    this.liveAnnouncer.announce(
      `Removed ${
        this.cart.isGroup(listItem)
          ? 'group of ' + getPluralFormOfRecordName(resourceType)
          : getRecordName(resourceType)
      } from the cart.`
    );
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
   * Clears the selected records of the specified resource type.
   * @param resourceType - resource type
   */
  clearSelectedRecords(resourceType: string): void {
    const resourceTable = this.tables?.find(
      (table) => table.resourceType === resourceType
    );
    return resourceTable?.selectedResources.clear();
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
      [].concat(...(this.cart.getListItems('ResearchStudy') || [])),
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
      this.loadVariables();
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
   * Loads the next page of the specified resource type.
   * @param resourceType - resource type.
   */
  loadNextPage(resourceType: string): void {
    if (resourceType === 'Variable') {
      this.loadVariables(
        this.selectRecords.currentState[resourceType].currentPage + 1
      );
    } else {
      this.selectRecords.loadNextPage(resourceType);
    }
  }
}
