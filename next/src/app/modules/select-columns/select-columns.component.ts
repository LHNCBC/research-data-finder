import { Component, Inject, OnInit } from '@angular/core';
import { ColumnDescription } from '../../types/column.description';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

/**
 * Component for selecting columns displayed in resource table
 */
@Component({
  selector: 'app-select-columns',
  templateUrl: './select-columns.component.html',
  styleUrls: ['./select-columns.component.less']
})
export class SelectColumnsComponent implements OnInit {
  columns: ColumnDescription[] = [];

  constructor(
    private dialogRef: MatDialogRef<SelectColumnsComponent>,
    @Inject(MAT_DIALOG_DATA) data
  ) {
    this.columns = data.columns;
  }

  ngOnInit(): void {}

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    this.dialogRef.close(this.columns);
  }
}
