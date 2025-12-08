import { Component, QueryList, ViewChild, ViewChildren } from '@angular/core';
import {
  ResourceTableComponent
} from './resource-table/resource-table.component';
import { MatTabGroup } from '@angular/material/tabs';

/**
 * Base class for components which has a list of ResourceTableComponent as children.
 * Those components share methods like downloadCsv().
 */
@Component({
  selector: 'app-resource-table-parent',
  template: ''
})
export abstract class ResourceTableParentComponent {
  @ViewChild(MatTabGroup) tabGroup: MatTabGroup;
  @ViewChildren(ResourceTableComponent)
  tables: QueryList<ResourceTableComponent>;
  // Array of visible resource type names
  visibleResourceTypes: string[];

  /**
   * Returns resourceType for the selected tab
   */
  getCurrentResourceType(): string {
    return this.visibleResourceTypes[this.tabGroup.selectedIndex];
  }

  /**
   * Initiates downloading of resourceTable data in CSV format.
   */
  downloadCsv(): void {
    const currentResourceType = this.getCurrentResourceType();
    const currentResourceTable = this.tables.find(
      (resourceTable) => resourceTable.resourceType === currentResourceType
    );
    currentResourceTable.downloadCsv();
  }

  /**
   * Initiates downloading of resourceTable data in JSON format.
   */
  downloadJson(): void {
    const currentResourceType = this.getCurrentResourceType();
    const currentResourceTable = this.tables.find(
      (resourceTable) => resourceTable.resourceType === currentResourceType
    );
    currentResourceTable.downloadJson();
  }

}
