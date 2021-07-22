import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { filter } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { saveAs } from 'file-saver';
import { ViewCohortPageComponent } from '../step-3-view-cohort-page/view-cohort-page.component';
import { SearchParameter } from '../../types/search.parameter';
import Resource = fhir.Resource;
import { SelectAnAreaOfInterestComponent } from '../step-1-select-an-area-of-interest/select-an-area-of-interest.component';

/**
 * The main component provides a wizard-like workflow by dividing content into logical steps.
 */
@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.less']
})
export class StepperComponent implements OnDestroy {
  @ViewChild('stepper') public stepper: MatStepper;
  @ViewChild('selectAnAreaOfInterest')
  public selectAreaOfInterestComponent: SelectAnAreaOfInterestComponent;
  @ViewChild('defineCohortComponent') public defineCohortComponent;
  @ViewChild('viewCohortComponent')
  public viewCohortComponent: ViewCohortPageComponent;

  settings: FormControl = new FormControl();
  defineCohort: FormControl = new FormControl();
  serverInitialized = false;
  subscription: Subscription;
  // Whether the search for Patients has been started
  searchedForPatients = false;

  constructor(
    public columnDescriptions: ColumnDescriptionsService,
    private fhirBackend: FhirBackendService,
    private cdr: ChangeDetectorRef
  ) {
    this.subscription = fhirBackend.initialized
      .pipe(filter((status) => status === ConnectionStatus.Disconnect))
      .subscribe(() => {
        this.searchedForPatients = false;
        this.stepper.steps.forEach((s) => s.reset());
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.fhirBackend.disconnect();
  }

  /**
   * Runs searching for Patient resources
   */
  searchForPatients(): void {
    this.searchedForPatients = true;
    this.cdr.detectChanges();
    if (this.stepper.selected.completed) {
      this.defineCohortComponent.searchForPatients(
        this.selectAreaOfInterestComponent.getResearchStudySearchParam()
      );
      this.stepper.next();
    } else {
      // The search for Patients was not started
      this.searchedForPatients = false;
    }
  }

  /**
   * Save criteria and data into json file for future loading.
   */
  saveCohort(): void {
    const objectToSave = {
      serviceBaseUrl: this.fhirBackend.serviceBaseUrl,
      maxPatientCount: this.defineCohortComponent.defineCohortForm.value
        .maxPatientsNumber,
      rawCriteria: this.defineCohortComponent.patientParams.parameterList.value,
      data:
        this.viewCohortComponent?.resourceTableComponent?.dataSource?.data ??
        [],
      researchStudies: this.selectAreaOfInterestComponent.getResearchStudySearchParam()
    };
    const blob = new Blob([JSON.stringify(objectToSave, null, 2)], {
      type: 'text/json;charset=utf-8',
      endings: 'native'
    });
    saveAs(blob, `cohort-${objectToSave.data.length}.json`);
  }

  /**
   * Process file and load criteria and patient list data.
   */
  loadCohort(event, fromResearchStudyStep = false): void {
    if (event.target.files.length === 1) {
      const reader = new FileReader();
      const filename = event.target.files[0].name;
      reader.onload = (loadEvent) => {
        try {
          const blobData = JSON.parse(loadEvent.target.result as string);
          const {
            serviceBaseUrl,
            maxPatientCount,
            rawCriteria,
            data,
            researchStudies
          } = blobData;
          if (serviceBaseUrl !== this.fhirBackend.serviceBaseUrl) {
            alert(
              'Error: Inapplicable data, because it was downloaded from another server.'
            );
            return;
          }
          // Set max field value.
          this.defineCohortComponent.defineCohortForm
            .get('maxPatientsNumber')
            .setValue(maxPatientCount);
          // Set search parameter form values.
          this.defineCohortComponent.patientParams.parameterList.clear();
          (rawCriteria as SearchParameter[]).forEach((searchParam) => {
            this.defineCohortComponent.patientParams.parameterList.push(
              new FormControl(searchParam)
            );
          });
          // Set selected research studies.
          this.selectAreaOfInterestComponent.selectLoadedResearchStudies(
            researchStudies
          );
          // Set patient table data.
          this.loadPatientsData(data, fromResearchStudyStep);
          this.defineCohortComponent.loadingStatistics = [
            [`Data loaded from file ${filename}.`]
          ];
        } catch (e) {
          alert('Error: ' + e.message);
        }
      };
      reader.readAsText(event.target.files[0]);
    }
    event.target.value = '';
  }

  /**
   * Re-populate the patient table
   * @private
   */
  private loadPatientsData(
    data: Resource[],
    fromResearchStudyStep = false
  ): void {
    this.defineCohortComponent.patientStream = new Subject<Resource>();
    this.stepper.next();
    if (fromResearchStudyStep) {
      this.stepper.next();
    }
    setTimeout(() => {
      data.forEach((resource) => {
        this.defineCohortComponent.patientStream.next(resource);
      });
      this.defineCohortComponent.patientStream.complete();
    });
  }
}
