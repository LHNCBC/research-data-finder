import { Component, Inject } from '@angular/core';
import { ColumnDescription } from '../../types/column.description';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Component for selecting columns displayed in resource table
 */
@Component({
  selector: 'app-select-columns',
  templateUrl: './select-columns.component.html',
  styleUrls: ['./select-columns.component.less']
})
export class SelectColumnsComponent {
  resourceType: string;
  // Array of available column descriptions for the resource table.
  columns: ColumnDescription[] = [];
  // Observable of the column names of the table columns with data
  columnsWithData: BehaviorSubject<string[]>;
  // Observable of the column descriptions of the available table
  // columns with data
  columns$: Observable<ColumnDescription[]>;

  constructor(
    private dialogRef: MatDialogRef<SelectColumnsComponent>,
    @Inject(MAT_DIALOG_DATA) data,
    private liveAnnouncer: LiveAnnouncer
  ) {
    this.resourceType = data.resourceType;
    this.columns = data.columns;
    this.columnsWithData = data.columnsWithData;
    this.columns$ = this.columnsWithData.pipe(
      map((columnsWithData) =>
        this.columns.filter(
          (column) =>
            columnsWithData.length === 0 ||
            columnsWithData.indexOf(column.element) !== -1
        )
      )
    );
  }

  /**
   * Closes dialog.
   */
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Save columns visibility changes.
   */
  save(): void {
    if (!this.hasVisibleSelectedColumns()) {
      this.clearSelection();
    }
    this.dialogRef.close({
      columns: this.columns
    });
  }

  /**
   * Checks if there are some selected columns in the dialog.
   */
  hasVisibleSelectedColumns(): boolean {
    return this.columns.some(
      (column) =>
        column.visible &&
        (this.columnsWithData.value.length === 0 ||
          this.columnsWithData.value.indexOf(column.element) !== -1)
    );
  }

  /**
   * Marks all columns as invisible to show only the default columns.
   */
  clearSelection(): void {
    this.columns.forEach((x) => (x.visible = false));
  }

  /**
   * Marks all columns as invisible to show only the default columns and
   * announce this to the user.
   */
  clearSelectionWithAnnouncement() {
    this.clearSelection();
    this.liveAnnouncer.announce('All columns have been deselected.');
  }
}
