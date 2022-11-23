import {
  ControlValueAccessor,
  UntypedFormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator
} from '@angular/forms';
import { forwardRef, Provider, Type } from '@angular/core';

/**
 * Function to create the providers for components
 * which use ControlValueAccessor interface.
 * @param type - component type which extends `BaseControlValueAccessor`
 */
export function createControlValueAccessorProviders(
  type: Type<BaseControlValueAccessor<any>>
): Provider[] {
  return [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => type),
      multi: true
    }
  ];
}

/**
 * Base class for components which use ControlValueAccessor
 * interface as required by Angular.
 */
export abstract class BaseControlValueAccessor<T>
  implements ControlValueAccessor {
  // Callback function that is called when the control's value changes in the UI
  onChange: (newVal: T) => void = () => {};
  // Callback function that is called when the control should be considered blurred or “touched”
  onTouched: () => void = () => {};

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value - New value to be written to the model.
   */
  abstract writeValue(value: T): void;

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param fn - Callback to be triggered when the value changes.
   */
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  /**
   * Part of the ControlValueAccessor interface required
   * to integrate with Angular's core forms API.
   *
   * @param fn - Callback to be triggered when the component has been touched.
   */
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
}

/**
 * Function to create the providers for components
 * which use ControlValueAccessor & Validator interfaces.
 * @param type - component type which extends `BaseControlValueAccessorAndValidator`
 */
export function createControlValueAccessorAndValidatorProviders(
  type: Type<BaseControlValueAccessorAndValidator<any>>
): Provider[] {
  return [
    ...createControlValueAccessorProviders(type),
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => type),
      multi: true
    }
  ];
}

/**
 * Base class for components which use ControlValueAccessor & Validator interfaces.
 */
export abstract class BaseControlValueAccessorAndValidator<T>
  extends BaseControlValueAccessor<T>
  implements Validator {
  abstract validate({ value }: UntypedFormControl): ValidationErrors | null;
}
