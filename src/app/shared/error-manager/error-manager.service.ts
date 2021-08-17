import { ErrorStateMatcher } from '@angular/material/core';
import {
  FormArray,
  FormControl,
  FormGroupDirective,
  NgForm,
  ValidationErrors
} from '@angular/forms';
import { Injectable, Optional, SkipSelf } from '@angular/core';

/**
 * Service for managing validation and displaying errors.
 */
@Injectable()
export class ErrorManager implements ErrorStateMatcher {
  constructor(@SkipSelf() @Optional() parent: ErrorManager) {
    if (parent) {
      // Use previously provided instance if exists
      return parent;
    }
  }
  // Array of controls for which errors should be displayed
  controlToShowErrors: FormControl[] = [];
  // Array of all controls
  allControls: FormControl[] = [];

  // Determines the visibility of an error
  isErrorState(
    control: FormControl | null,
    form: FormGroupDirective | NgForm | null
  ): boolean {
    const showError = this.controlToShowErrors.indexOf(control) !== -1;
    return !!(control && control.invalid && showError);
  }

  /**
   * Adds a new formControl
   */
  addControl(control: FormControl): void {
    this.allControls.push(control);
  }

  /**
   * Removes formControl
   */
  removeControl(control: FormControl): void {
    const index = this.allControls.indexOf(control);
    this.allControls.splice(index, 1);
    if (index < this.controlToShowErrors.length) {
      this.controlToShowErrors.splice(index, 1);
    }
  }

  /**
   * Shows errors for existing formControls
   */
  showErrors(): void {
    this.controlToShowErrors = this.allControls.concat();
  }

  /**
   * Returns errors
   */
  get errors(): ValidationErrors | null {
    const length = this.allControls.length;
    for (let i = 0; i < length; ++i) {
      if (this.allControls[i].invalid) {
        return { required: true };
      }
    }
    return null;
  }
}
