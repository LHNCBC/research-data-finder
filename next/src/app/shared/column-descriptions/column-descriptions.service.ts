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

@Injectable()
export class ColumnDescriptionsService {
  visibleColumns: { [key: string]: BehaviorSubject<ColumnDescription[]> } = {};
  subscriptions: Subscription[] = [];
  constructor(
    private fhirBackend: FhirBackendService,
    private dialog: MatDialog
  ) {}

  /**
   * Open dialog to manage visible columns
   */
  openColumnsDialog(resourceType: string): void {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true;
    dialogConfig.hasBackdrop = true;
    dialogConfig.data = {
      columns: this.fhirBackend.getColumns(resourceType)
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
            map(() => this.fhirBackend.getColumns(resourceType))
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
   * Unsubscribe from all subscriptions.
   */
  destroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }
}
