import { Directive, OnDestroy, OnInit, Optional, Self } from '@angular/core';
import { FormControlDirective, FormControlName, NgModel } from '@angular/forms';
import { ErrorManager } from './error-manager.service';

/**
 * This directive is used to collect formControls assigned in the markup
 * into the ErrorManager service.
 */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '[formControl],[formControlName],[ngModel]'
})
export class FormControlCollectorDirective implements OnInit, OnDestroy {
  constructor(
    @Self() @Optional() private formControlDirective: FormControlDirective,
    @Self() @Optional() private formControlName: FormControlName,
    @Self() @Optional() private ngModel: NgModel,
    private errorManager: ErrorManager
  ) {}

  ngOnInit(): void {
    this.errorManager.addControl(
      this.formControlDirective?.control ||
        this.formControlName?.control ||
        this.ngModel?.control
    );
  }

  ngOnDestroy(): void {
    this.errorManager.removeControl(
      this.formControlDirective?.control ||
        this.formControlName?.control ||
        this.ngModel?.control
    );
  }
}
