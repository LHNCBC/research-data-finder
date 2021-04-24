import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';

/**
 * data type used for this control
 */
interface DatesFromTo {
  from: string;
  to: string;
}

/**
 * Component for from/to date inputs combined together as one control
 */
@Component({
  selector: 'app-dates-from-to',
  templateUrl: './dates-from-to.component.html',
  styleUrls: ['./dates-from-to.component.less'],
  providers: createControlValueAccessorProviders(DatesFromToComponent)
})
export class DatesFromToComponent extends BaseControlValueAccessor<DatesFromTo> {
  from: FormControl = new FormControl('');
  to: FormControl = new FormControl('');

  writeValue(value: DatesFromTo): void {
    this.from.setValue(value.from);
    this.to.setValue(value.to);
  }
}
