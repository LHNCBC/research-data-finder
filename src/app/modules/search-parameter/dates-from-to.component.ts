import { AfterViewInit, Component, OnInit } from '@angular/core';
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
  implements OnInit, AfterViewInit {
  get value(): DatesFromTo {
    return {
      from: this.from.value,
      to: this.to.value
    };
  }

  // Default value to be used when user creates a second date range criterion.
  static defaultValue: DatesFromTo = null;

  from: FormControl = new FormControl('');
  to: FormControl = new FormControl('');

  ngOnInit(): void {
    // tell Angular forms API to update parent form control
    this.from.valueChanges.subscribe((from) => {
      this.onChange(this.value);
      if (from) {
        DatesFromToComponent.defaultValue = this.value;
      }
    });
    this.to.valueChanges.subscribe((to) => {
      this.onChange(this.value);
      if (to) {
        DatesFromToComponent.defaultValue = this.value;
      }
    });
  }

  ngAfterViewInit(): void {
    // Write with default value.
    if (
      !this.value.from &&
      !this.value.to &&
      DatesFromToComponent.defaultValue &&
      DatesFromToComponent.defaultValue.from &&
      DatesFromToComponent.defaultValue.to
    ) {
      this.writeValue(DatesFromToComponent.defaultValue);
    }
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: DatesFromTo): void {
    this.from.setValue(value.from);
    this.to.setValue(value.to);
  }
}
