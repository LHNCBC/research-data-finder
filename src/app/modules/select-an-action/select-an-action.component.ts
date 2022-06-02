import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

export enum CreateCohortMode {
  UNSELECTED,
  BROWSE,
  SEARCH
}

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
    public fhirBackend: FhirBackendService
  ) {
    this.subscription = this.fhirBackend.initialized
      .pipe(filter((status) => status === ConnectionStatus.Disconnect))
      .subscribe(() => {
        this.createCohortMode.setValue(CreateCohortMode.UNSELECTED);
      });
  }

  subscription: Subscription;
  createCohortMode = new FormControl(CreateCohortMode.UNSELECTED);
  CreateCohortMode = CreateCohortMode;

  ngOnInit(): void {}

  /**
   * Performs cleanup when a component instance is destroyed.
   */
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
