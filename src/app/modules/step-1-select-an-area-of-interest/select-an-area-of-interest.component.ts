import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
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
  option = new FormControl(SelectOptions.Skip);
  showResearchStudiesWithoutSubjects = new FormControl(false);
  subscription: Subscription;
  researchStudiesSubscription: Subscription;
  researchStudyStream: Subject<Resource>;
  showTable = false;
  @ViewChild('resourceTableComponent') public resourceTableComponent;

  /**
   * Create and initialize instance of component.
   */
  constructor(
    private fhirBackend: FhirBackendService,
    private http: HttpClient,
    public columnDescriptions: ColumnDescriptionsService,
    cdr: ChangeDetectorRef
  ) {
    this.subscription = combineLatest([
      this.option.valueChanges,
      this.fhirBackend.initialized,
      this.showResearchStudiesWithoutSubjects.valueChanges.pipe(
        startWith(this.showResearchStudiesWithoutSubjects.value as boolean)
      )
    ])
      .pipe(
        tap(() => {
          this.showTable = false;
          this.researchStudiesSubscription?.unsubscribe();
        }),
        filter(([option, initialized]) => {
          return (
            option === SelectOptions.ResearchStudy &&
            initialized === ConnectionStatus.Ready
          );
        })
      )
      .subscribe(([, , showResearchStudiesWithoutSubjects]) => {
        this.researchStudyStream = new Subject<Resource>();
        this.showTable = true;
        // Added "detectChanges" to prevent this issue:
        // If queries are cached, then the values will be sent to the Subject
        // before the ResourceTableComponent subscribes to the resource stream.
        cdr.detectChanges();
        if (showResearchStudiesWithoutSubjects) {
          this.loadResearchStudies('$fhir/ResearchStudy?_count=500');
        } else {
          const statuses = Object.keys(
            this.fhirBackend.getCurrentDefinitions().valueSetMapByPath[
              'ResearchSubject.status'
            ]
          ).join(',');
          this.loadResearchStudies(
            `$fhir/ResearchStudy?_count=500&_has:ResearchSubject:study:status=${statuses}`
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
   * @param url - request URL
   */
  loadResearchStudies(url: string): void {
    this.researchStudiesSubscription = this.http
      .get(url)
      .subscribe((data: Bundle) => {
        if (!data.entry) {
          this.researchStudyStream.complete();
          return;
        } else {
          data.entry?.forEach((item) => {
            this.researchStudyStream.next(item.resource);
          });
          const nextBundleUrl = data.link.find((l) => l.relation === 'next')
            ?.url;
          if (nextBundleUrl) {
            this.loadResearchStudies(nextBundleUrl);
          } else {
            this.researchStudyStream.complete();
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
    } else {
      return this.resourceTableComponent.selectedResources.selected.map(
        (r) => r.id
      );
    }
  }
}
