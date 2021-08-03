import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnInit,
  ViewChild
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

/**
 * Component for filtering criteria of a resource table column
 */
@Component({
  selector: 'app-resource-table-filter',
  templateUrl: './resource-table-filter.component.html',
  styleUrls: ['./resource-table-filter.component.less']
})
export class ResourceTableFilterComponent implements AfterViewInit {
  static idPrefix = 'resource-table-filter-';
  static idIndex = 0;
  inputId =
    ResourceTableFilterComponent.idPrefix +
    ++ResourceTableFilterComponent.idIndex;
  column: string;
  value: string;
  @ViewChild('input') input: ElementRef<HTMLInputElement>;

  constructor(
    private dialogRef: MatDialogRef<ResourceTableFilterComponent>,
    @Inject(MAT_DIALOG_DATA) data
  ) {
    this.column = data.column;
    this.value = data.value;
  }

  ngAfterViewInit(): void {
    this.input.nativeElement.value = this.value;
    this.dialogRef.backdropClick().subscribe(() => this.close());
  }

  close(): void {
    this.dialogRef.close(this.input.nativeElement.value);
  }

  @HostListener('document:keydown.escape') onKeyDown(): void {
    this.close();
  }
}
