import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import {
  BaseControlValueAccessorAndValidator,
  createControlValueAccessorAndValidatorProviders
} from '../base-control-value-accessor';
import { SearchParametersComponent } from '../search-parameters/search-parameters.component';

import { ErrorManager } from '../../shared/error-manager/error-manager.service';

import { CohortService } from '../../shared/cohort/cohort.service';

/**
 * Component for defining criteria to build a cohort of Patient resources.
 */
@Component({
  selector: 'app-define-cohort-page',
  templateUrl: './define-cohort-page.component.html',
  styleUrls: ['./define-cohort-page.component.less'],
  providers: [
    ...createControlValueAccessorAndValidatorProviders(
      DefineCohortPageComponent
    ),
    ErrorManager
  ]
})
export class DefineCohortPageComponent
  extends BaseControlValueAccessorAndValidator<any>
  implements OnInit {
  defineCohortForm: FormGroup;

  @ViewChild('patientParams') patientParams: SearchParametersComponent;

  constructor(
    private formBuilder: FormBuilder,
    private errorManager: ErrorManager,
    public cohort: CohortService
  ) {
    super();
  }

  ngOnInit(): void {
    this.defineCohortForm = this.formBuilder.group({
      maxNumberOfPatients: [this.cohort.maxPatientCount, Validators.required]
    });
    this.defineCohortForm.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  validate({ value }: FormControl): ValidationErrors | null {
    return this.defineCohortForm.get('maxNumberOfPatients').errors;
  }

  writeValue(obj: any): void {}

  /**
   * Search for a list of Patient resources using the criteria tree.
   * This method searches from the server and checks Patient resources
   * against all criteria, and emits Patient resources that match criteria
   * through {patientStream}
   */
  searchForPatients(researchStudyIds: string[] = null): void {
    this.cohort.searchForPatients(
      this.patientParams.queryCtrl.value,
      this.defineCohortForm.value.maxNumberOfPatients,
      researchStudyIds
    );
  }

  /**
   * Checks for errors
   */
  hasErrors(): boolean {
    return this.errorManager.errors !== null || this.defineCohortForm.invalid;
  }

  /**
   * Shows errors for existing formControls
   */
  showErrors(): void {
    this.errorManager.showErrors();
  }
}
