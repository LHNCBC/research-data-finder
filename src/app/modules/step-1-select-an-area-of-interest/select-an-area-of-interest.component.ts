import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { filter, finalize, startWith, tap } from 'rxjs/operators';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import Resource = fhir.Resource;
import { ResearchStudyService } from '../../shared/research-study/research-study.service';

export enum SelectOptions {
  showOnlyStudiesWithSubjects = 0,
  showAllStudies
}

@Component({
  selector: 'app-select-an-area-of-interest',
  templateUrl: './select-an-area-of-interest.component.html',
  styleUrls: ['./select-an-area-of-interest.component.less']
})
export class SelectAnAreaOfInterestComponent implements OnInit, OnDestroy {
  // Publish enum for template
  SelectOptions = SelectOptions;
  option = new UntypedFormControl(SelectOptions.showOnlyStudiesWithSubjects);
  subscription: Subscription;
  researchStudyStream: Observable<Resource[]>;
  showTable = false;
  // A list of items that system will select once table loading is complete.
  idsToSelect: string[] = [];
  @ViewChild('resourceTableComponent') public resourceTableComponent;

  /**
   * Create and initialize instance of component.
   */
  constructor(
    private fhirBackend: FhirBackendService,
    public columnDescriptions: ColumnDescriptionsService,
    public researchStudy: ResearchStudyService
  ) {}

  ngOnInit(): void {
    this.subscription = combineLatest([
      this.option.valueChanges.pipe(
        startWith(SelectOptions.showOnlyStudiesWithSubjects)
      ),
      this.fhirBackend.initialized
    ])
      .pipe(
        tap(() => {
          this.showTable = false;
          this.resourceTableComponent?.clearSelection();
        }),
        filter(([_, initialized]) => {
          return initialized === ConnectionStatus.Ready;
        })
      )
      .subscribe(([showResearchStudiesWithoutSubjects, _]) => {
        let researchStudyStream;
        this.showTable = true;

        if (showResearchStudiesWithoutSubjects) {
          researchStudyStream = this.researchStudy.loadResearchStudies(
            '$fhir/ResearchStudy?_count=100&_total=accurate'
          );
        } else {
          this.option.disable({ emitEvent: false });
          const statuses = Object.keys(
            this.fhirBackend.getCurrentDefinitions().valueSetMapByPath[
              'ResearchSubject.status'
            ]
          ).join(',');
          researchStudyStream = this.researchStudy.loadResearchStudies(
            `$fhir/ResearchStudy?_count=100&_has:ResearchSubject:study:status=${statuses}&_total=accurate`,
            true
          );
        }
        this.researchStudyStream = researchStudyStream.pipe(
          finalize(() => {
            if (!showResearchStudiesWithoutSubjects) {
              this.option.enable({ emitEvent: false });
            }
            if (this.idsToSelect.length) {
              this.resourceTableComponent.setSelectedIds(this.idsToSelect);
              this.idsToSelect.length = 0;
            }
          })
        );
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * Get search parameter of selected research studies' IDs
   */
  getResearchStudySearchParam(): string[] {
    if (!this.resourceTableComponent) {
      return [];
    }
    if (
      this.resourceTableComponent.selectedResources.selected.length ===
      this.researchStudy.currentState.myStudyIds.length
    ) {
      // If all applicable rows are selected, use empty array (same as no rows selected).
      return [];
    }
    return this.resourceTableComponent.selectedResources.selected.map(
      (r) => r.id
    );
  }

  /**
   * Re-populate research study table with selected items.
   */
  selectLoadedResearchStudies(ids: string[]): void {
    this.resourceTableComponent.isLoading
      ? (this.idsToSelect = ids)
      : this.resourceTableComponent.setSelectedIds(ids);
  }
}
