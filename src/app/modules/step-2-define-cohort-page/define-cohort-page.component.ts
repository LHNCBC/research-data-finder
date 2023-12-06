import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import {
  BaseControlValueAccessorAndValidator,
  createControlValueAccessorAndValidatorProviders
} from '../base-control-value-accessor';
import { SearchParametersComponent } from '../search-parameters/search-parameters.component';

import { ErrorManager } from '../../shared/error-manager/error-manager.service';

import { CohortService, MAX_PAGE_SIZE } from '../../shared/cohort/cohort.service';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { SelectRecordsService } from '../../shared/select-records/select-records.service';
import {LiveAnnouncer} from "@angular/cdk/a11y";

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
  implements OnInit, OnDestroy {
  MAX_PAGE_SIZE = MAX_PAGE_SIZE;
  defineCohortForm: UntypedFormGroup;
  subscriptions: Subscription[] = [];

  @ViewChild('patientParams') patientParams: SearchParametersComponent;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private errorManager: ErrorManager,
    public fhirBackend: FhirBackendService,
    public selectRecords: SelectRecordsService,
    public cohort: CohortService,
    private liveAnnouncer: LiveAnnouncer
  ) {
    super();

    this.subscriptions.push(
      fhirBackend.initialized
        .pipe(filter((status) => status === ConnectionStatus.Ready))
        .subscribe(() => {
          selectRecords.resetAll();
          if (this.fhirBackend.isDbgap(this.fhirBackend.serviceBaseUrl)) {
            // Load the available studies to use for limiting variables
            // in the following steps.
            const resourceType = 'ResearchStudy';
            const hasStatuses =
              '&_has:ResearchSubject:study:status=' +
              Object.keys(
                this.fhirBackend.getCurrentDefinitions().valueSetMapByPath[
                  'ResearchSubject.status'
                ]
              ).join(',');
            this.selectRecords.loadFirstPage(
              resourceType,
              `$fhir/${resourceType}?_count=3000${hasStatuses}`,
              {}
            );
          }
        })
    );
  }

  ngOnInit(): void {
    this.defineCohortForm = this.formBuilder.group({
      maxNumberOfPatients: [this.cohort.maxPatientCount, Validators.compose([Validators.required, Validators.max(MAX_PAGE_SIZE)])]
    });
    this.defineCohortForm.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  validate({ value }: UntypedFormControl): ValidationErrors | null {
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
    if (this.defineCohortForm.controls['maxNumberOfPatients'].invalid) {
      this.liveAnnouncer.announce('Maximum number of patients field is not valid.');
    }
    this.errorManager.showErrors();
    setTimeout(() => {
      document.querySelector('.mat-form-field-invalid')?.scrollIntoView();
    });
  }
}
