import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import Bundle = fhir.Bundle;
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { combineLatest, Subject, Subscription } from 'rxjs';
import { filter, startWith, tap } from 'rxjs/operators';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import Resource = fhir.Resource;

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
  option = new FormControl(SelectOptions.showOnlyStudiesWithSubjects);
  subscription: Subscription;
  researchStudiesSubscription: Subscription;
  researchStudyStream: Subject<Resource>;
  showTable = false;
  // A list of items that system will select once table loading is complete.
  idsToSelect: string[] = [];
  myStudyIds: string[] = [];
  @ViewChild('resourceTableComponent') public resourceTableComponent;

  /**
   * Create and initialize instance of component.
   */
  constructor(
    private fhirBackend: FhirBackendService,
    private http: HttpClient,
    public columnDescriptions: ColumnDescriptionsService,
    private cdr: ChangeDetectorRef
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
          this.researchStudiesSubscription?.unsubscribe();
          this.resourceTableComponent?.clearSelection();
        }),
        filter(([_, initialized]) => {
          return initialized === ConnectionStatus.Ready;
        })
      )
      .subscribe(([showResearchStudiesWithoutSubjects, _]) => {
        this.researchStudyStream = new Subject<Resource>();
        this.showTable = true;
        // Added "detectChanges" to prevent this issue:
        // If queries are cached, then the values will be sent to the Subject
        // before the ResourceTableComponent subscribes to the resource stream.
        this.cdr.detectChanges();
        if (showResearchStudiesWithoutSubjects) {
          this.loadResearchStudies('$fhir/ResearchStudy?_count=100');
        } else {
          this.option.disable({ emitEvent: false });
          const statuses = Object.keys(
            this.fhirBackend.getCurrentDefinitions().valueSetMapByPath[
              'ResearchSubject.status'
            ]
          ).join(',');
          this.loadResearchStudies(
            `$fhir/ResearchStudy?_count=100&_has:ResearchSubject:study:status=${statuses}`,
            true
          );
        }
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.researchStudiesSubscription?.unsubscribe();
  }

  /**
   * Calls server for a bundle of ResearchStudy resources.
   * Will be recursively called if having next bundle.
   * @param url - request URL.
   * @param myStudiesOnly - whether it's loading only studies that user has access to.
   */
  loadResearchStudies(url: string, myStudiesOnly = false): void {
    const myStudyIds: string[] = [];
    this.researchStudiesSubscription = this.http
      .get(url)
      .subscribe((data: Bundle) => {
        data.entry?.forEach((item) => {
          this.researchStudyStream.next(item.resource);
          if (myStudiesOnly) {
            myStudyIds.push(item.resource.id);
          }
        });
        const nextBundleUrl = data.link.find((l) => l.relation === 'next')?.url;
        if (nextBundleUrl) {
          this.loadResearchStudies(nextBundleUrl, myStudiesOnly);
        } else {
          this.researchStudyStream.complete();
          if (myStudiesOnly) {
            this.myStudyIds = myStudyIds;
            this.option.enable({ emitEvent: false });
          }
          if (this.idsToSelect.length) {
            this.resourceTableComponent.setSelectedIds(this.idsToSelect);
            this.idsToSelect.length = 0;
          }
        }
      });
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
      this.myStudyIds.length
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
