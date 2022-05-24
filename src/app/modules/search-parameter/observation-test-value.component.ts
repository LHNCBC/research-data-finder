import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';

/**
 * data type used for this control
 */
interface ObservationTestValue {
  formValue: {
    testValueComparator: string;
    testValuePrefix: string;
    testValueModifier: string;
    testValue: number | string;
    testValueUnit: string;
  };
  observationDataType: string;
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
  implements OnInit, OnChanges {
  @Input() datatype: string;
  @Input() observationCodes: string[] = [];
  @Input() loincCodes: string[] = [];
  selectedDatatype = '';

  form = new FormGroup({
    testValueComparator: new FormControl(''),
    testValuePrefix: new FormControl(''),
    testValueModifier: new FormControl(''),
    testValue: new FormControl('', Validators.required),
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
      unit: false
    },
    String: {
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
      const formValue = this.form.getRawValue();
      if (!this.datatype) {
        // In case of "Variable Value" without "Variable Name", move value from 'testValueComparator' to construct the right query.
        formValue.testValuePrefix =
          (this.selectedDatatype === 'Quantity' &&
            formValue.testValueComparator) ||
          '';
        formValue.testValueModifier =
          (this.selectedDatatype === 'String' &&
            formValue.testValueComparator) ||
          '';
      }
      this.onChange({
        formValue,
        observationDataType: this.selectedDatatype
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.datatype) {
      this.selectedDatatype = this.datatype || 'Quantity';
    }
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: ObservationTestValue): void {
    if (!this.selectedDatatype) {
      this.selectedDatatype = value.observationDataType || 'Quantity';
    }
    this.form.setValue(
      (value && value.formValue) || {
        testValueComparator: '',
        testValuePrefix: '',
        testValueModifier: '',
        testValue: '',
        testValueUnit: ''
      }
    );
    if (
      this.datatype &&
      !value.formValue?.testValueModifier &&
      this.typeDescriptions[this.selectedDatatype].modifiers &&
      this.typeDescriptions[this.selectedDatatype].modifiers.length === 1
    ) {
      // default and disable control if only one option
      this.form
        .get('testValueModifier')
        .setValue(this.typeDescriptions[this.selectedDatatype].modifiers[0][1]);
      this.form.get('testValueModifier').disable();
    }
  }

  /**
   * When user select a comparator from the whole list of comparators ('testValueComparator' control).
   */
  setSelectedDatatype(value): void {
    this.selectedDatatype = value;
    this.form.get('testValue').setValue('');
    this.form.get('testValueUnit').setValue('');
  }
}
