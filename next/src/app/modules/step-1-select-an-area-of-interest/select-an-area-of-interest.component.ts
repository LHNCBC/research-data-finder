import { Component, Input } from '@angular/core';
import { ColumnDescription } from '../../types/column.description';
import Bundle = fhir.Bundle;
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';

export enum SelectOptions {
  Skip = 0,
  ResearchStudy
}

@Component({
  selector: 'app-select-an-area-of-interest',
  templateUrl: './select-an-area-of-interest.component.html',
  styleUrls: ['./select-an-area-of-interest.component.less']
})
export class SelectAnAreaOfInterestComponent {
  // Publish enum for template
  SelectOptions = SelectOptions;

  @Input()
  columnDescriptions: ColumnDescription[];
  initialBundle: Bundle;
  showTable = false;
  option = new FormControl(SelectOptions.Skip);

  /**
   * Create and initialize instance of component.
   */
  constructor(
    private fhirBackend: FhirBackendService,
    private http: HttpClient
  ) {
    combineLatest([this.option.valueChanges, this.fhirBackend.initialized])
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
}
