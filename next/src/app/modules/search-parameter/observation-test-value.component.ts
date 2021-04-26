import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';

/**
 * data type used for this control
 */
interface ObservationTestValue {
  testValuePrefix: string;
  testValue: number;
  testValueUnit: string;
  from: string;
  to: string;
}

/**
 * Component for from/to date inputs combined together as one control
 */
@Component({
  selector: 'app-observation-test-value',
  templateUrl: './observation-test-value.component.html',
  styleUrls: ['./observation-test-value.component.less'],
  providers: createControlValueAccessorProviders(ObservationTestValueComponent)
})
export class ObservationTestValueComponent extends BaseControlValueAccessor<ObservationTestValue> {
  readonly PREFIXOPTIONS = ['=', 'not equal', '>', '<', '>=', '<='];
  testValuePrefix: FormControl = new FormControl('');
  testValue: FormControl = new FormControl('');
  testValueUnit: FormControl = new FormControl('');
  from: FormControl = new FormControl('');
  to: FormControl = new FormControl('');

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: ObservationTestValue): void {
    this.testValuePrefix.setValue(value.testValuePrefix);
    this.testValue.setValue(value.testValue);
    this.testValueUnit.setValue(value.testValueUnit);
    this.from.setValue(value.from);
    this.to.setValue(value.to);
  }
}
