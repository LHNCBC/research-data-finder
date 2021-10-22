import {
  Attribute,
  Component,
  ElementRef,
  Input,
  OnInit,
  Optional,
  ViewChild
} from '@angular/core';
import {
  BaseControlValueAccessorAndValidator,
  createControlValueAccessorAndValidatorProviders
} from '../base-control-value-accessor';
import { ErrorManager } from '../../shared/error-manager/error-manager.service';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, ValidationErrors } from '@angular/forms';
import { combineLatest, Observable, ReplaySubject } from 'rxjs';
import { map, startWith, take } from 'rxjs/operators';

/**
 * Autocomplete option can have display name, value and description.
 * In simple cases, when the name is equal to the value and there is no
 * description, it can be a string or only have a name property.
 */
export type AutocompleteOption =
  | {
      name: string;
      value?: string;
      desc?: string;
    }
  | string;

/**
 * Component for selecting values from a list of options using autocomplete.
 */
@Component({
  selector: 'app-autocomplete',
  templateUrl: './autocomplete.component.html',
  styleUrls: ['./autocomplete.component.less'],
  providers: [
    ...createControlValueAccessorAndValidatorProviders(AutocompleteComponent),
    ErrorManager,
    {
      provide: ErrorStateMatcher,
      useExisting: ErrorManager
    }
  ]
})
export class AutocompleteComponent
  extends BaseControlValueAccessorAndValidator<any>
  implements OnInit {
  private errors: ValidationErrors = null;

  /**
   * Constructor
   * @param required - value of the "required" attribute of the host element,
   *   used to check for the existence of the attribute. If the attribute exists,
   *   marks the component that cannot have an empty value.
   */
  constructor(@Optional() @Attribute('required') required: any) {
    super();
    this.required = required !== null;
    this.updateValidationStatus();
  }

  @Input() set options(options: AutocompleteOption[]) {
    this.options$.next(options);
  }

  control: FormControl = new FormControl('', () => {
    return this.errors;
  });

  @ViewChild('inputField') inputField: ElementRef;
  private required = false;
  selectedOption = null;
  @Input() label = '';
  @Input() placeholder = '';
  options$ = new ReplaySubject<AutocompleteOption[]>();
  filteredOptions$: Observable<AutocompleteOption[]>;

  /**
   * Returns the option value for the data model
   */
  static getOptionValue(option: AutocompleteOption): string {
    return option instanceof Object ? option?.value || option?.name : option;
  }

  /**
   * Returns the textual representation of the option for the input field
   */
  getOptionText(option: AutocompleteOption): string {
    return option instanceof Object ? option?.name : option;
  }

  ngOnInit(): void {
    this.filteredOptions$ = combineLatest([
      this.control.valueChanges.pipe(startWith('')),
      this.options$
    ]).pipe(
      map(([value, options]) => {
        const filteredOptions = options.filter((option) =>
          this.getOptionText(option).toLowerCase().includes(value.toLowerCase())
        );
        const selectedOption =
          filteredOptions.find(
            (option) => this.getOptionText(option) === value
          ) || null;
        if (
          this.getOptionText(this.selectedOption) !==
          this.getOptionText(selectedOption)
        ) {
          if (selectedOption) {
            const newValue = AutocompleteComponent.getOptionValue(
              selectedOption
            );
            this.selectedOption = selectedOption;
            this.updateValidationStatus();
            this.onChange(newValue);
          } else {
            this.selectedOption = null;
            this.updateValidationStatus();
            this.onChange('');
          }
        }
        return filteredOptions;
      })
    );
  }

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: string): void {
    this.options$.pipe(take(1)).subscribe((options) => {
      const selectedOption =
        options.find(
          (option) => AutocompleteComponent.getOptionValue(option) === value
        ) || null;
      this.selectedOption = selectedOption;
      if (selectedOption) {
        this.control.setValue(
          selectedOption instanceof Object
            ? selectedOption.name
            : selectedOption
        );
      } else {
        this.control.setValue('');
      }
      this.updateValidationStatus();
    });
  }

  /**
   * Performs synchronous validation.
   */
  validate({ value }: FormControl): ValidationErrors {
    return this.errors;
  }

  /**
   * Updates validation status
   */
  updateValidationStatus(): void {
    this.errors =
      !this.required || this.selectedOption
        ? null
        : {
            required: true
          };

    this.control.setErrors(this.errors);
  }

  /**
   * Enables or disables component.
   * @param isDisabled The disabled status to set on the element
   */
  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.control.disable({ emitEvent: false });
    } else {
      this.control.enable({ emitEvent: false });
    }
  }

  /**
   * Focuses in the input field.
   */
  focus(): void {
    this.inputField.nativeElement.focus();
  }
}
