import { Component, Input } from '@angular/core';
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
  testValueModifier: string;
  testValue: number | string;
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
  @Input() datatype: string;
  testValuePrefix: FormControl = new FormControl('');
  testValueModifier: FormControl = new FormControl('');
  testValue: FormControl = new FormControl('');
  testValueUnit: FormControl = new FormControl('');
  from: FormControl = new FormControl('');
  to: FormControl = new FormControl('');
  // Mapping for supported value[x] properties of Observation
  readonly typeDescriptions = {
    Quantity: {
      searchValPrefixes: [
        ['=', 'eq'],
        ['not equal', 'ne'],
        ['>', 'gt'],
        ['<', 'lt'],
        ['>=', 'ge'],
        ['<=', 'le']
      ],
      unit: true
    },
    CodeableConcept: {
      modifiers: [['starts with', ':text']],
      unit: false
    },
    string: {
      modifiers: [
        ['starts with', ''],
        ['contains', ':contains'],
        ['exact', ':exact']
      ],
      unit: false
    }
  };

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: ObservationTestValue): void {
    this.testValuePrefix.setValue(value.testValuePrefix);
    if (
      !value.testValueModifier &&
      this.typeDescriptions[this.datatype].modifiers &&
      this.typeDescriptions[this.datatype].modifiers.length === 1
    ) {
      // default and disable control if only one option
      this.testValueModifier.setValue(
        this.typeDescriptions[this.datatype].modifiers[0][1]
      );
      this.testValueModifier.disable();
    } else {
      this.testValueModifier.setValue(value.testValueModifier);
    }
    this.testValue.setValue(value.testValue);
    this.testValueUnit.setValue(value.testValueUnit);
    this.from.setValue(value.from);
    this.to.setValue(value.to);
  }
}
