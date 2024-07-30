import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
import {
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { AutocompleteOption } from '../../types/autocompleteOption';

/**
 * data type used for this control
 */
export interface SearchParameterValue {
  // TODO: "observationDataType" should be renamed to "dataType", but this will
  //  affect backwards compatibility.
  observationDataType: string;
  testValuePrefix: string;
  testValueModifier: string;
  testValue: number | string;
  testValueUnit: string;
  testValuePrefix2?: string;
  testValue2?: number | string;
}

/**
 * Component for entering the value of a search parameter of a Quantity,
 * CodeableConcept, or String data type.
 */
@Component({
  selector: 'app-search-parameter-value',
  templateUrl: './search-parameter-value.component.html',
  styleUrls: ['./search-parameter-value.component.less'],
  providers: createControlValueAccessorProviders(SearchParameterValueComponent)
})
export class SearchParameterValueComponent
  extends BaseControlValueAccessor<SearchParameterValue>
  implements OnInit, OnChanges {
  @Input() datatype: string;
  @Input() observationCodes: string[] = [];
  @Input() loincCodes: string[] = [];
  @Input() unitList: AutocompleteOption[];
  @Input() required = true;
  // Label for the value input field.
  @Input() valueLabelText = 'Search parameter value';
  // Label for the unit input field.
  @Input() unitLabelText = 'Unit code';
  // Placeholder for the value input field. If not specified, the default
  // placeholder is used, which depends on the data type.
  @Input() valuePlaceholderText = '';
  selectedDatatype = 'Quantity';
  testValueComparator = 'Quantity - ';
  showAddLineButton = false;
  hasSecondLine = false;
  formValue = undefined;
  form = new UntypedFormGroup({
    testValuePrefix: new UntypedFormControl(''),
    testValueModifier: new UntypedFormControl(''),
    testValue: new UntypedFormControl('', Validators.required),
    testValueUnit: new UntypedFormControl(''),
    testValuePrefix2: new UntypedFormControl(''),
    testValue2: new UntypedFormControl('')
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
  // Mapping for range comparators
  readonly rangeComparatorOptions = {
    gt: [
      ['<', 'lt'],
      ['<=', 'le']
    ],
    lt: [
      ['>', 'gt'],
      ['>=', 'ge']
    ]
  };

  /**
   * Prefix value, e.g. 'lt','le'.
   */
  get prefixControlValue(): string {
    return this.formValue.testValuePrefix;
  }

  constructor(private liveAnnouncer: LiveAnnouncer) {
    super();
    this.rangeComparatorOptions['ge'] = this.rangeComparatorOptions.gt;
    this.rangeComparatorOptions['le'] = this.rangeComparatorOptions.lt;
  }

  ngOnInit(): void {
    this.form.get('testValuePrefix').valueChanges.subscribe((value: string) => {
      this.resetSecondLine();
      this.checkToShowAddButton(value);
    });
    this.form.valueChanges.subscribe(() => {
      this.formValue = this.form.getRawValue();
      if (!this.datatype) {
        // In case of "Variable Value" without "Variable Name", move value from 'testValueComparator' to construct the right query.
        this.formValue.testValuePrefix =
          (this.selectedDatatype === 'Quantity' &&
            this.testValueComparator.substr(11)) ||
          '';
        this.formValue.testValueModifier =
          (this.selectedDatatype === 'String' &&
            this.testValueComparator.substr(9)) ||
          '';
      }
      this.formValue.observationDataType =
        this.datatype || this.selectedDatatype;
      this.onChange(this.formValue);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.datatype) {
      this.selectedDatatype = this.datatype || 'Quantity';
    }
    if (changes.required) {
      this.form
        .get('testValue')
        .setValidators(this.required ? Validators.required : null);
    }
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: SearchParameterValue): void {
    this.form.patchValue(
      value || {
        testValuePrefix: '',
        testValueModifier: '',
        testValue: '',
        testValueUnit: '',
        testValuePrefix2: '',
        testValue2: ''
      }
    );
    if (
      this.datatype &&
      !value?.testValueModifier &&
      this.typeDescriptions[this.datatype].modifiers &&
      this.typeDescriptions[this.datatype].modifiers.length === 1
    ) {
      // default and disable control if only one option
      this.form
        .get('testValueModifier')
        .setValue(this.typeDescriptions[this.datatype].modifiers[0][1]);
      this.form.get('testValueModifier').disable();
    }
    if (!this.datatype) {
      this.selectedDatatype = value.observationDataType || 'Quantity';
      // Write back to the composite Comparator control.
      if (this.selectedDatatype === 'Quantity') {
        this.testValueComparator = `${this.selectedDatatype} - ${value.testValuePrefix}`;
      } else if (this.selectedDatatype === 'String') {
        this.testValueComparator = `${this.selectedDatatype} - ${value.testValueModifier}`;
      }
    }
    if (value?.testValuePrefix2 || value?.testValue2) {
      // Show the second line if the controls have value.
      this.hasSecondLine = true;
    }
    this.checkToShowAddButton(value?.testValuePrefix, false);
  }

  /**
   * ngModelChange event for the standalone 'testValueComparator' control
   * @param value e.g. 'Quantity - gt'
   */
  onComplexComparatorChange(value: string): void {
    this.testValueComparator = value;
    this.resetSecondLine();
    this.checkToShowAddButton(value.slice(-2));
  }

  /**
   * This is called when user selects a comparator from the whole list of comparators ('testValueComparator' control).
   */
  setSelectedDatatype(value): void {
    this.selectedDatatype = value;
    this.form.get('testValue').setValue('');
    this.form.get('testValueUnit').setValue('');
  }

  /**
   * Hide the second line.
   * The method is called when the comparator control in the first line is updated,
   * or when user clicks the 'remove' button on the second line.
   */
  resetSecondLine(): void {
    this.form.get('testValuePrefix2').setValue('');
    this.form.get('testValue2').setValue('');
    this.hasSecondLine = false;
  }

  /**
   * Add a second line for the other end of the range constraint.
   */
  addLine(): void {
    this.showAddLineButton = false;
    this.hasSecondLine = true;
    this.liveAnnouncer.announce('A new line has appeared.');
  }

  /**
   * Announce the addition of the 'add new line' button, if applicable.
   * @param value new value of the comparator, derived from Prefix control or testValueComparator control
   * @param announce whether to announce the new button, default to true
   * The button should be shown if the options selected in the first line comparator
   * control is '>', '>=', '<' or '<='.
   */
  checkToShowAddButton(value: string, announce = true): void {
    const oldValue = this.showAddLineButton;
    this.showAddLineButton =
      !this.hasSecondLine && this.rangeComparatorOptions[value] !== undefined;
    if (announce && this.showAddLineButton && !oldValue) {
      this.liveAnnouncer.announce(
        'A new button for adding a second line has appeared.'
      );
    }
  }
}
