import { Directive, OnDestroy, OnInit, Self } from '@angular/core';
import { FormControlDirective } from '@angular/forms';
import { ErrorManager } from './error-manager.service';

/**
 * This directive is used to collect formControls assigned in the markup
 * into the ErrorManager service.
 */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '[formControl]'
})
export class FormControlCollectorDirective implements OnInit, OnDestroy {
  constructor(
    @Self() private formControlDirective: FormControlDirective,
    private errorManager: ErrorManager
  ) {}

  ngOnInit(): void {
    this.errorManager.addControl(this.formControlDirective.control);
  }

  ngOnDestroy(): void {
    this.errorManager.removeControl(this.formControlDirective.control);
  }
}
