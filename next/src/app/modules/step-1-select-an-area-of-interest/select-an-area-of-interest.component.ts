import { Component, Input, OnDestroy } from '@angular/core';
import Bundle = fhir.Bundle;
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { combineLatest, Subscription } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';

export enum SelectOptions {
  Skip = 0,
  ResearchStudy
}

@Component({
  selector: 'app-select-an-area-of-interest',
  templateUrl: './select-an-area-of-interest.component.html',
  styleUrls: ['./select-an-area-of-interest.component.less']
})
export class SelectAnAreaOfInterestComponent implements OnDestroy {
  // Publish enum for template
  SelectOptions = SelectOptions;

  @Input()
  initialBundle: Bundle;
  showTable = false;
  option = new FormControl(SelectOptions.Skip);
  subscription: Subscription;

  /**
   * Create and initialize instance of component.
   */
  constructor(
    private fhirBackend: FhirBackendService,
    private http: HttpClient,
    public columnDescriptions: ColumnDescriptionsService
  ) {
    this.subscription = combineLatest([
      this.option.valueChanges,
      this.fhirBackend.initialized
    ])
      .pipe(
        tap(() => {
          this.showTable = false;
        }),
        filter(
          ([option, initialized]) =>
            option === SelectOptions.ResearchStudy &&
            initialized === ConnectionStatus.Ready
        )
      )
      .subscribe(() => {
        this.http
          .get('$fhir/ResearchStudy?_count=10')
          .subscribe((data: Bundle) => {
            this.initialBundle = data;
            this.showTable = true;
          });
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
