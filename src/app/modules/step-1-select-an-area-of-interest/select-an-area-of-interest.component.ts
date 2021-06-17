import { Component, OnDestroy, ViewChild } from '@angular/core';
import Bundle = fhir.Bundle;
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { combineLatest, Subject, Subscription } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
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
  subscription: Subscription;
  researchStudyStream: Subject<Resource>;
  showTable = false;
  // A list of items that system will select once table loading is complete.
  idsToSelect: string[] = [];
  @ViewChild('resourceTableComponent') public resourceTableComponent;

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
        this.researchStudyStream = new Subject<Resource>();
        this.showTable = true;
        this.callBatch('$fhir/ResearchStudy?_count=500');
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * calls server for a bundle of resources. Will be recursively called if having next bundle.
   */
  callBatch(url: string): void {
    this.http.get(url).subscribe((data: Bundle) => {
      if (!data.entry) {
        this.researchStudyStream.complete();
        return;
      } else {
        data.entry?.forEach((item) => {
          this.researchStudyStream.next(item.resource);
        });
        const nextBundleUrl = data.link.find((l) => l.relation === 'next')?.url;
        if (nextBundleUrl) {
          this.callBatch(nextBundleUrl);
        } else {
          this.researchStudyStream.complete();
          if (this.idsToSelect.length) {
            this.selectResearchStudies(this.idsToSelect);
            this.idsToSelect.length = 0;
          }
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

  /**
   * Re-populate research study table with selected items.
   * Update radio button selection accordingly.
   */
  loadSelectedResearchStudies(ids: string[]): void {
    if (this.option.value === SelectOptions.ResearchStudy && !ids.length) {
      this.option.setValue(SelectOptions.Skip);
      return;
    }
    if (this.option.value === SelectOptions.ResearchStudy && ids.length) {
      this.selectResearchStudies(ids);
      return;
    }
    if (this.option.value === SelectOptions.Skip && ids.length) {
      this.idsToSelect = ids;
      this.option.setValue(SelectOptions.ResearchStudy);
      return;
    }
  }

  /**
   * Select a list of items in table.
   */
  private selectResearchStudies(ids: string[]): void {
    this.resourceTableComponent.selectedResources.clear();
    const items = this.resourceTableComponent.dataSource.data.filter((r) =>
      ids.includes(r.id)
    );
    this.resourceTableComponent.selectedResources.select(...items);
  }
}
