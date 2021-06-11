import { Component, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { filter, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { saveAs } from 'file-saver';
import { ViewCohortPageComponent } from '../step-3-view-cohort-page/view-cohort-page.component';

/**
 * The main component provides a wizard-like workflow by dividing content into logical steps.
 */
@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.less']
})
export class StepperComponent implements OnDestroy {
  @ViewChild('stepper') private myStepper: MatStepper;
  @ViewChild('defineCohortComponent') public defineCohortComponent;
  @ViewChild('viewCohortComponent')
  public viewCohortComponent: ViewCohortPageComponent;

  settings: FormControl = new FormControl();
  defineCohort: FormControl = new FormControl();
  serverInitialized = false;
  subscription: Subscription;

  constructor(
    public columnDescriptions: ColumnDescriptionsService,
    private fhirBackend: FhirBackendService
  ) {
    this.subscription = fhirBackend.initialized
      .pipe(
        filter((status) => status === ConnectionStatus.Ready),
        take(1)
      )
      .subscribe(() => {
        this.serverInitialized = true;
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.columnDescriptions.destroy();
  }

  saveCohort(): void {
    const objectToSave = {
      serviceBaseUrl: this.fhirBackend.serviceBaseUrl,
      maxPatientCount: this.defineCohortComponent.defineCohortForm.value
        .maxPatientsNumber,
      rawCriteria: this.defineCohortComponent.patientParams.parameterList.value,
      data:
        this.viewCohortComponent?.resourceTableComponent?.dataSource?.data || []
    };
    const blob = new Blob([JSON.stringify(objectToSave, null, 2)], {
      type: 'text/json;charset=utf-8',
      endings: 'native'
    });
    saveAs(blob, `cohort-${objectToSave.data.length}.json`);
  }
}
