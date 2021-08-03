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
import Def from 'autocomplete-lhc';

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
  @ViewChild('input') input: ElementRef<HTMLInputElement>;
  value: string | string[];
  useAutocomplete = false;
  options: string[] = [];
  // Autocompleter instance
  acInstance: Def.Autocompleter.Prefetch;

  constructor(
    private dialogRef: MatDialogRef<ResourceTableFilterComponent>,
    @Inject(MAT_DIALOG_DATA) data
  ) {
    this.value = data.value;
    this.useAutocomplete = data.useAutocomplete;
    this.options = data.options;
  }

  ngAfterViewInit(): void {
    if (this.useAutocomplete) {
      this.acInstance = new Def.Autocompleter.Prefetch(
        this.inputId,
        this.options,
        { maxSelect: '*' }
      );
      if (this.value && this.value.length) {
        (this.value as string[]).forEach((v) => {
          this.acInstance.addToSelectedArea(v);
        });
      }
    } else {
      this.input.nativeElement.value = this.value as string;
    }
    this.dialogRef.backdropClick().subscribe(() => this.close());
  }

  close(): void {
    if (this.useAutocomplete) {
      this.dialogRef.close(this.acInstance.getSelectedItems());
    } else {
      this.dialogRef.close(this.input.nativeElement.value);
    }
  }

  @HostListener('document:keydown.escape') onKeyDown(): void {
    this.close();
  }
}
