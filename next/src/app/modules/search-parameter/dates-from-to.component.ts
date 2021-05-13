import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';

/**
 * data type used for this control
 */
export interface DatesFromTo {
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
export class DatesFromToComponent
  extends BaseControlValueAccessor<DatesFromTo>
  implements OnInit {
  from: FormControl = new FormControl('');
  to: FormControl = new FormControl('');

  get value(): DatesFromTo {
    return {
      from: this.from.value,
      to: this.to.value
    };
  }

  ngOnInit(): void {
    // tell Angular forms API to update parent form control
    this.from.valueChanges.subscribe(() => {
      this.onChange(this.value);
    });
    this.to.valueChanges.subscribe(() => {
      this.onChange(this.value);
    });
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: DatesFromTo): void {
    this.from.setValue(value.from);
    this.to.setValue(value.to);
  }
}
