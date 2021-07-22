import { Injectable } from '@angular/core';
import { ColumnDescription } from '../../types/column.description';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import {
  ConnectionStatus,
  FhirBackendService
} from '../fhir-backend/fhir-backend.service';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { SelectColumnsComponent } from '../../modules/select-columns/select-columns.component';
import { filter, map } from 'rxjs/operators';
import { capitalize } from '../utils';
import { ColumnValuesService } from '../column-values/column-values.service';
import { SettingsService } from '../settings-service/settings.service';

@Injectable({
  providedIn: 'root'
})
export class ColumnDescriptionsService {
  constructor(
    private fhirBackend: FhirBackendService,
    private dialog: MatDialog,
    private columnValues: ColumnValuesService,
    private settings: SettingsService
  ) {}
  visibleColumns: { [key: string]: BehaviorSubject<ColumnDescription[]> } = {};
  subscriptions: Subscription[] = [];

  /**
   * Compare function for column descriptions
   */
  private static sortColumns(
    a: ColumnDescription,
    b: ColumnDescription
  ): number {
    if (!a.sortOrder && !b.sortOrder) {
      return 0;
    }
    if (!a.sortOrder && b.sortOrder) {
      return 1;
    }
    if (a.sortOrder && !b.sortOrder) {
      return -1;
    }
    return a.sortOrder - b.sortOrder;
  }

  /**
   * Open dialog to manage visible columns
   */
  openColumnsDialog(resourceType: string): void {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.hasBackdrop = true;
    dialogConfig.data = {
      columns: this.getAvailableColumns(resourceType)
    };
    const dialogRef = this.dialog.open(SelectColumnsComponent, dialogConfig);
    dialogRef.afterClosed().subscribe((columns: ColumnDescription[]) => {
      if (!columns) {
        return;
      }
      this.visibleColumns[resourceType].next(columns.filter((x) => x.visible));
      window.localStorage.setItem(
        resourceType + '-columns',
        columns
          .filter((x) => x.visible)
          .map((x) => x.element)
          .join(',')
      );
    });
  }

  /**
   * Returns an Observable of visible column descriptions for the resource table
   * @param resourceType - resource type
   */
  getVisibleColumns(resourceType: string): Observable<ColumnDescription[]> {
    if (!this.visibleColumns[resourceType]) {
      this.visibleColumns[resourceType] = new BehaviorSubject([]);
      this.subscriptions.push(
        // Initialize visible columns on server initialization
        this.fhirBackend.initialized
          .pipe(
            filter((status) => status === ConnectionStatus.Ready),
            map(() => this.getAvailableColumns(resourceType))
          )
          .subscribe((columns) => {
            this.visibleColumns[resourceType].next(
              columns.filter((x) => x.visible)
            );
          })
      );
    }
    return this.visibleColumns[resourceType];
  }

  /**
   * Returns an array of available column descriptions for the resource table.
   * @param resourceType - resource type
   */
  getAvailableColumns(resourceType: string): ColumnDescription[] {
    const currentDefinitions = this.fhirBackend.getCurrentDefinitions();
    const columnDescriptions =
      currentDefinitions.resources[resourceType].columnDescriptions;
    const visibleColumnsRawString = window.localStorage.getItem(
      resourceType + '-columns'
    );
    const visibleColumnNames = visibleColumnsRawString
      ? visibleColumnsRawString.split(',')
      : [];
    const sortSettings = this.settings.get('columnSort')?.[resourceType] ?? [];
    sortSettings.forEach((s, i) => {
      const match = columnDescriptions.find((c) => c.element === s);
      if (match) {
        match.sortOrder = i + 1;
      }
    });

    return (
      columnDescriptions
        .concat(this.settings.get(`customColumns.${resourceType}`) || [])
        .map((column) => {
          const displayName =
            column.displayName ||
            capitalize(column.element)
              .replace(/\[x]$/, '')
              .split(/(?=[A-Z])/)
              .join(' ');
          return {
            ...column,
            displayName,
            // Use only supported column types
            types: column.types.filter(
              (type) => this.columnValues.getValueFn(type) !== undefined
            ),
            visible:
              visibleColumnNames.indexOf(
                column.customElement || column.element
              ) !== -1
          };
        })
        // Exclude unsupported columns
        .filter((column) => column.types.length)
        // Sort based on settings
        .sort(ColumnDescriptionsService.sortColumns)
    );
  }

  /**
   * Unsubscribe from all subscriptions.
   */
  destroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }
}
