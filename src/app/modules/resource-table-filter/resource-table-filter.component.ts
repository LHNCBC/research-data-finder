import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
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
export class ResourceTableFilterComponent implements AfterViewInit, OnDestroy {
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
  searchResultsElm: HTMLElement;

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
          this.acInstance.storeSelectedItem(v);
          this.acInstance.addToSelectedArea(v);
        });
      }
      // When page is scrolled down and a modal is in place, autocomplete-lhc don't calculate
      // the correct top position to place the search results. The result of 'top' calculation
      // is actually against the viewport, even though JQuery offset() is supposed to return
      // the value against document.
      // Setting position to 'fixed' solves this issue.
      // See https://github.com/lhncbc/autocomplete-lhc/blob/master/source/autoCompBase.js#L1684.
      this.searchResultsElm = document.getElementById('searchResults');
      this.searchResultsElm.style.position = 'fixed';
    } else {
      this.input.nativeElement.value = this.value as string;
    }
    this.dialogRef.backdropClick().subscribe(() => this.close());
  }

  ngOnDestroy(): void {
    if (this.searchResultsElm) {
      // Set position property back so it works properly in other autocomplete instances that
      // aren't built on a modal, e.g. in search criteria inputs.
      this.searchResultsElm.style.position = 'absolute';
    }
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
