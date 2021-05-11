import { Component, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { filter, take } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { DefineCohortPageComponent } from '../step-2-define-cohort-page/define-cohort-page.component';

import Resource = fhir.Resource;

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
  @ViewChild(DefineCohortPageComponent) public defineCohortComponent;

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
}
