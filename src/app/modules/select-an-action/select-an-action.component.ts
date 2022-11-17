import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { Subscription } from 'rxjs';
import {
  CohortService,
  CreateCohortMode
} from '../../shared/cohort/cohort.service';

/**
 * Component for selecting how to create a cohort of Patient resources.
 */
@Component({
  selector: 'app-select-an-action',
  templateUrl: './select-an-action.component.html',
  styleUrls: ['./select-an-action.component.less']
})
export class SelectAnActionComponent implements OnInit, OnDestroy {
  constructor(
    public columnDescriptions: ColumnDescriptionsService,
    public fhirBackend: FhirBackendService,
    private cohort: CohortService
  ) {
    this.subscriptions.push(
      this.createCohortMode.valueChanges.subscribe((value) => {
        // Recreating the following steps when selection changes
        this.cohort.createCohortMode = CreateCohortMode.UNSELECTED;
        setTimeout(() => {
          this.cohort.createCohortMode = value;
        });
      })
    );
  }

  subscriptions: Subscription[] = [];
  createCohortMode = new UntypedFormControl(CreateCohortMode.UNSELECTED);
  CreateCohortMode = CreateCohortMode;

  ngOnInit(): void {}

  /**
   * Performs cleanup when a component instance is destroyed.
   */
  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }
}
