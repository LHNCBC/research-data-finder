import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import {
  MatAutocomplete,
  MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { FormControl } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders,
} from '../base-control-value-accessor';

// See examples:
// Original:
// https://material.angular.io/components/chips/overview
// chips autocomplete:
// https://github.com/mdrafee03/chip-autocomplete
// ng-select:
// https://ng-select.github.io/ng-select#/multiselect-checkbox
// ng-select for material:
// https://github.com/ng-matero/extensions/tree/master/projects/extensions/select
// https://stackblitz.com/edit/ng-select-b37iax?file=app%2Fapp.component.ts
// search field for material select:
// https://www.npmjs.com/package/ngx-mat-select-search

/**
 * Component for selecting LOINC variables.
 */
@Component({
  selector: 'app-loinc-variables-selector',
  templateUrl: './loinc-variables-selector.component.html',
  styleUrls: ['./loinc-variables-selector.component.less'],
  providers: createControlValueAccessorProviders(
    LoincVariablesSelectorComponent
  ),
})
export class LoincVariablesSelectorComponent
  extends BaseControlValueAccessor<string[]>
  implements OnInit {
  selectable = true;
  removable = true;
  separatorKeysCodes: number[] = [ENTER, COMMA];
  inputCtrl = new FormControl();
  filteredItems: Observable<string[]>;
  selectedItems: string[] = [];
  allItems: string[] = [
    'ABC',
    'ABCDE',
    'Glucose Ur-msCnc',
    'Feeling tired or having little energy',
    'DEF',
  ];

  @ViewChild('inputField') inputElementRef: ElementRef<HTMLInputElement>;
  @ViewChild('autocomplete') matAutocomplete: MatAutocomplete;
  @ViewChild('trigger') matAutocompleteTrigger: MatAutocompleteTrigger;

  constructor() {
    super();
  }

  /**
   * Sets the select's value. Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: string[]): void {
    this.selectedItems = value;
  }

  ngOnInit(): void {
    this.filteredItems = this.inputCtrl.valueChanges.pipe(
      startWith(''),
      map((inputValue: string | null) => this._filter(inputValue))
    );
  }

  add(event: MatChipInputEvent): void {
    const input = event.input;
    const value = event.value;

    // Add our item
    if ((value || '').trim()) {
      this.selectedItems.push(value.trim());
    }

    // Reset the input value
    if (input) {
      input.value = '';
    }

    this.inputCtrl.setValue('');
  }

  remove(item: string): void {
    const index = this.selectedItems.indexOf(item);

    if (index >= 0) {
      this.selectedItems.splice(index, 1);
    }

    this.inputCtrl.setValue('');
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    this.selectedItems.push(event.option.viewValue);
    this.inputElementRef.nativeElement.value = '';
    this.inputCtrl.setValue('');

    // setTimeout(() => {
    //   this.matAutocompleteTrigger.openPanel();
    // },1);
  }

  clickOption($event: MouseEvent, item: string): void {
    // this.selectedItems.push(item);
    // this.inputElementRef.nativeElement.value = '';
    // this.inputCtrl.setValue('');
    // $event.stopPropagation();
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();

    return this.allItems.filter(
      (item) =>
        this.selectedItems.indexOf(item) === -1 &&
        item.toLowerCase().indexOf(filterValue) === 0
    );
  }
}
