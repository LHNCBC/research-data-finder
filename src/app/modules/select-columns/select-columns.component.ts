import { Component, Inject, OnInit } from '@angular/core';
import { ColumnDescription } from '../../types/column.description';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Component for selecting columns displayed in resource table
 */
@Component({
  selector: 'app-select-columns',
  templateUrl: './select-columns.component.html',
  styleUrls: ['./select-columns.component.less']
})
export class SelectColumnsComponent implements OnInit {
  resourceType: string;
  columns: ColumnDescription[] = [];
  columnsWithData: BehaviorSubject<string[]>;

  constructor(
    private dialogRef: MatDialogRef<SelectColumnsComponent>,
    @Inject(MAT_DIALOG_DATA) data
  ) {
    this.resourceType = data.resourceType;
    this.columns = data.columns;
    this.columnsWithData = data.columnsWithData;
  }

  ngOnInit(): void {}

  getColumns(): Observable<ColumnDescription[]> {
    return this.columnsWithData.pipe(
      map((columnsWithData) =>
        this.columns.filter(
          (column) =>
            columnsWithData.length === 0 ||
            columnsWithData.indexOf(column.element) !== -1
        )
      )
    );
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (!this.hasVisibleSelectedColumns()) {
      this.columns.forEach((column) => {
        column.visible = false;
      });
    }
    this.dialogRef.close({
      columns: this.columns
    });
  }

  hasVisibleSelectedColumns(): boolean {
    return this.columns.some(
      (column) =>
        column.visible &&
        (this.columnsWithData.value.length === 0 ||
          this.columnsWithData.value.indexOf(column.element) !== -1)
    );
  }

  clearSelection(): void {
    this.columns.forEach((x) => (x.visible = false));
  }
}
