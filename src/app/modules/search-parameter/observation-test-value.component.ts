import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
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
export class ObservationTestValueComponent
  extends BaseControlValueAccessor<ObservationTestValue>
  implements OnInit {
  @Input() datatype: string;
  form = new FormGroup({
    testValuePrefix: new FormControl(''),
    testValueModifier: new FormControl(''),
    testValue: new FormControl(''),
    testValueUnit: new FormControl('')
  });
  // Mapping for supported value[x] properties of Observation
  readonly typeDescriptions = {
    Quantity: {
      searchValPrefixes: [
        // See https://www.hl7.org/fhir/search.html#prefix
        // if no prefix is present, the prefix 'eq' is assumed.
        ['=', ''],
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

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => {
      this.onChange(this.form.getRawValue());
    });
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: ObservationTestValue): void {
    this.form.setValue(
      value || {
        testValuePrefix: '',
        testValueModifier: '',
        testValue: '',
        testValueUnit: ''
      }
    );
    if (
      !value.testValueModifier &&
      this.typeDescriptions[this.datatype].modifiers &&
      this.typeDescriptions[this.datatype].modifiers.length === 1
    ) {
      // default and disable control if only one option
      this.form
        .get('testValueModifier')
        .setValue(this.typeDescriptions[this.datatype].modifiers[0][1]);
      this.form.get('testValueModifier').disable();
    }
  }
}
