import { Attribute, Component, Input, OnInit, Optional } from '@angular/core';
import {
  BaseControlValueAccessorAndValidator,
  createControlValueAccessorAndValidatorProviders
} from '../../base-control-value-accessor';
import { ErrorManager } from '../../../shared/error-manager/error-manager.service';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, ValidationErrors } from '@angular/forms';
import { combineLatest, Observable, ReplaySubject } from 'rxjs';
import { map, startWith, take } from 'rxjs/operators';

export type AutocompleteOption =
  | {
      name: string;
      value?: string;
      desc?: string;
    }
  | string;

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
  constructor(@Optional() @Attribute('required') required: any) {
    super();
    this.required = required !== null;
  }
  @Input() set options(options: AutocompleteOption[]) {
    this.options$.next(options);
  }

  control: FormControl = new FormControl('', () => {
    return this.errors;
  });
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
            this.onChange(newValue);
          } else {
            this.selectedOption = null;
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
    });
  }

  /**
   * Performs synchronous validation.
   */
  validate({ value }: FormControl): ValidationErrors {
    this.errors =
      !this.required || value
        ? null
        : {
            required: true
          };

    return this.errors;
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
}
