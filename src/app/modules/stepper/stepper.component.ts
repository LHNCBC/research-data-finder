import { AfterViewInit, Component, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatStep, MatStepper } from '@angular/material/stepper';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { Subject, Subscription } from 'rxjs';
import { saveAs } from 'file-saver';
import { SelectAnAreaOfInterestComponent } from '../step-1-select-an-area-of-interest/select-an-area-of-interest.component';
import { DefineCohortPageComponent } from '../step-2-define-cohort-page/define-cohort-page.component';
import { ViewCohortPageComponent } from '../step-3-view-cohort-page/view-cohort-page.component';
import { PullDataPageComponent } from '../step-4-pull-data-page/pull-data-page.component';
import {
  CohortService,
  CreateCohortMode
} from '../../shared/cohort/cohort.service';
import { PullDataService } from '../../shared/pull-data/pull-data.service';
import pkg from '../../../../package.json';
import { findLast } from 'lodash-es';
import { getUrlParam } from '../../shared/utils';
import Patient = fhir.Patient;
import { SelectRecordsService } from '../../shared/select-records/select-records.service';
import { RasTokenService } from '../../shared/ras-token/ras-token.service';
import { SelectRecordsPageComponent } from '../select-records-page/select-records-page.component';
import { SelectAnActionComponent } from '../select-an-action/select-an-action.component';

// Ordered list of steps (should be the same as in the template)
// The main purpose of this is to determine the name of the previous or next
// visible step before the template is rendered so that the
// "NG0100: ExpressionChangedAfterItHasBeenCheckedError" error does not occur.
export enum Step {
  SETTINGS,
  SELECT_AN_ACTION,
  SELECT_RESEARCH_STUDIES,
  SELECT_RECORDS,
  BROWSE_PUBLIC_DATA,
  DEFINE_COHORT,
  VIEW_COHORT,
  PULL_DATA_FOR_THE_COHORT
}

/**
 * The main component provides a wizard-like workflow by dividing content into logical steps.
 */
@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.less']
})
export class StepperComponent implements AfterViewInit, OnDestroy {
  @ViewChild('stepper') public stepper: MatStepper;
  @ViewChild('defineCohortStep') public defineCohortStep: MatStep;
  @ViewChild('selectRecordsStep') public selectRecordsStep: MatStep;
  @ViewChild(SelectAnAreaOfInterestComponent)
  public selectAreaOfInterestComponent: SelectAnAreaOfInterestComponent;
  @ViewChild(SelectAnActionComponent)
  public selectAnActionComponent: SelectAnActionComponent;
  @ViewChild(DefineCohortPageComponent)
  public defineCohortComponent: DefineCohortPageComponent;
  @ViewChild(SelectRecordsPageComponent)
  public selectRecordsComponent: SelectRecordsPageComponent;
  @ViewChild(ViewCohortPageComponent)
  public viewCohortComponent: ViewCohortPageComponent;
  @ViewChild(PullDataPageComponent)
  public pullDataPageComponent: PullDataPageComponent;

  allowChangeCreateCohortMode = false;

  defineCohort: FormControl = new FormControl();
  subscription: Subscription;
  CreateCohortMode = CreateCohortMode;
  // Publish enum for template
  Step = Step;
  // Step descriptions.
  // The main purpose of this is to determine the name of the previous or next
  // visible step before the template is rendered so that the
  // "NG0100: ExpressionChangedAfterItHasBeenCheckedError" error does not occur.
  stepDescriptions: Array<{
    // Step label
    label: string;
    // Visibility condition
    isVisible: () => boolean;
  }> = [];

  // Temporarily disable RAS until it's approved.
  enableRas = false;

  constructor(
    public columnDescriptions: ColumnDescriptionsService,
    public fhirBackend: FhirBackendService,
    public cohort: CohortService,
    public pullData: PullDataService,
    public selectRecord: SelectRecordsService,
    public rasToken: RasTokenService
  ) {
    this.stepDescriptions[Step.SETTINGS] = {
      label: 'Settings',
      isVisible: () => true
    };
    this.stepDescriptions[Step.SELECT_AN_ACTION] = {
      label: 'Select an action',
      isVisible: () => this.allowChangeCreateCohortMode
    };
    this.stepDescriptions[Step.SELECT_RESEARCH_STUDIES] = {
      label: 'Select Research Studies',
      isVisible: () =>
        this.fhirBackend.features.hasResearchStudy &&
        !this.allowChangeCreateCohortMode &&
        this.cohort.createCohortMode === CreateCohortMode.SEARCH
    };
    this.stepDescriptions[Step.SELECT_RECORDS] = {
      label: 'Select records',
      isVisible: () => this.cohort.createCohortMode === CreateCohortMode.BROWSE
    };
    this.stepDescriptions[Step.BROWSE_PUBLIC_DATA] = {
      label: 'Browse public data',
      isVisible: () =>
        this.cohort.createCohortMode === CreateCohortMode.NO_COHORT
    };
    this.stepDescriptions[Step.DEFINE_COHORT] = {
      label: 'Define cohort',
      isVisible: () => this.cohort.createCohortMode === CreateCohortMode.SEARCH
    };
    this.stepDescriptions[Step.VIEW_COHORT] = {
      label: 'View cohort',
      isVisible: () =>
        [CreateCohortMode.SEARCH, CreateCohortMode.BROWSE].includes(
          this.cohort.createCohortMode
        )
    };
    this.stepDescriptions[Step.PULL_DATA_FOR_THE_COHORT] = {
      label: 'Pull data for the cohort',
      isVisible: () =>
        [CreateCohortMode.SEARCH, CreateCohortMode.BROWSE].includes(
          this.cohort.createCohortMode
        )
    };

    this.subscription = this.fhirBackend.initialized.subscribe((status) => {
      if (status === ConnectionStatus.Disconnect) {
        this.stepper.steps.forEach((s) => s.reset());
        this.stepper.selectedIndex = Step.SETTINGS;
      } else if (status === ConnectionStatus.Ready) {
        this.allowChangeCreateCohortMode =
          getUrlParam('alpha-version') === 'enable' &&
          this.fhirBackend.isDbgap(this.fhirBackend.serviceBaseUrl);
        if (!this.allowChangeCreateCohortMode) {
          this.cohort.createCohortMode = CreateCohortMode.SEARCH;
        } else {
          if (!this.rasToken.rasTokenValidated) {
            this.cohort.createCohortMode = CreateCohortMode.UNSELECTED;
            this.selectAnActionComponent?.createCohortMode.setValue(
              CreateCohortMode.UNSELECTED
            );
          } else {
            // If it came from '/request-redirect-token-callback' and RAS token
            // has been validated, go back to Select An Action step and restore
            // user's selection before contacting RAS.
            const selectedCreateCohortMode = sessionStorage.getItem(
              'selectedCreateCohortMode'
            ) as CreateCohortMode;
            setTimeout(() => {
              this.stepper.selectedIndex = Step.SELECT_AN_ACTION;
              this.selectAnActionComponent.createCohortMode.setValue(
                selectedCreateCohortMode
              );
              setTimeout(() => {
                this.stepper.next();
              }, 0);
            }, 0);
          }
        }
      }
    });
  }

  /**
   * A lifecycle hook that is called after Angular has fully initialized
   * a component's view.
   */
  ngAfterViewInit(): void {
    if (this.defineCohortStep) {
      this.defineCohortStep.completed = false;
    }
  }

  /**
   * Performs cleanup when a component instance is destroyed.
   */
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.fhirBackend.disconnect();
  }

  /**
   * Runs searching for Patient resources
   */
  searchForPatients(): void {
    if (this.defineCohortStep) {
      this.defineCohortStep.completed = !this.defineCohortComponent.hasErrors();
      if (this.defineCohortStep.completed) {
        if (this.selectAreaOfInterestComponent) {
          this.defineCohortComponent.searchForPatients(
            this.selectAreaOfInterestComponent.getResearchStudySearchParam()
          );
        } else {
          this.defineCohortComponent.searchForPatients();
        }
        this.stepper.next();
      } else {
        this.defineCohortComponent.showErrors();
      }
    } else {
      this.selectRecordsStep.completed = !this.selectRecordsComponent.hasErrors();
      if (this.selectRecordsStep.completed) {
        this.selectRecordsComponent.searchForPatients();
        this.stepper.next();
      } else {
        this.selectRecordsComponent.showErrors();
      }
    }
  }

  /**
   * Save criteria and data into json file for future loading.
   */
  saveCohort(): void {
    const objectToSave = {
      version: pkg.version,
      serviceBaseUrl: this.fhirBackend.serviceBaseUrl,
      maxPatientCount: this.cohort.maxPatientCount,
      rawCriteria: this.cohort.criteria,
      data:
        this.viewCohortComponent?.resourceTableComponent?.dataSource?.data.map(
          (i) => i.resource
        ) ?? [],
      researchStudies:
        this.selectAreaOfInterestComponent?.getResearchStudySearchParam() ?? []
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
    // TODO
    if (event.target.files.length === 1) {
      const reader = new FileReader();
      const filename = event.target.files[0].name;
      reader.onload = (loadEvent) => {
        try {
          const blobData = JSON.parse(loadEvent.target.result as string);
          const {
            version,
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
            .get('maxNumberOfPatients')
            .setValue(maxPatientCount);
          // Update criteria object if the cohort was downloaded from an older version.
          if (!version) {
            this.cohort.updateOldFormatCriteria(rawCriteria);
          }
          // Set search parameter form values.
          this.defineCohortComponent.patientParams.queryCtrl.setValue(
            rawCriteria
          );
          this.cohort.criteria$.next(rawCriteria);
          // Set selected research studies.
          this.selectAreaOfInterestComponent?.selectLoadedResearchStudies(
            researchStudies
          );
          // Set patient table data.
          this.loadPatientsData(data, fromResearchStudyStep);
          this.cohort.loadingStatistics = [
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
    data: Patient[],
    fromResearchStudyStep = false
  ): void {
    this.defineCohortStep.completed = true;
    const patientStream = new Subject<Patient[]>();
    this.cohort.patientStream = patientStream.asObservable();
    this.stepper.next();
    if (fromResearchStudyStep) {
      this.stepper.next();
    }
    setTimeout(() => {
      this.cohort.currentState.patients = data;
      patientStream.next(data);
      patientStream.complete();
    });
  }

  /**
   * Returns the step label
   * @param step - step number
   */
  getLabel(step: Step): string {
    return this.stepDescriptions[step].label;
  }

  /**
   * Returns the previous step label
   * @param step - current step number
   */
  getPrevStepLabel(step: Step): string {
    return findLast(this.stepDescriptions.slice(0, step), (desc) =>
      desc.isVisible()
    )?.label;
  }

  /**
   * Returns the next step label
   * @param step - current step number
   */
  getNextStepLabel(step: Step): string {
    return this.stepDescriptions
      .slice(step + 1)
      .find((desc) => desc.isVisible())?.label;
  }

  /**
   * Returns the current step label
   * @param step - current step number
   */
  isVisible(step: Step): boolean {
    return this.stepDescriptions[step].isVisible();
  }

  /**
   * Contact rdf-server for dbGap login, if required.
   */
  onSelectAnActionNext(createCohortModeValue: CreateCohortMode): void {
    if (
      this.enableRas &&
      this.fhirBackend.isDbgap(this.fhirBackend.serviceBaseUrl) &&
      [CreateCohortMode.BROWSE, CreateCohortMode.SEARCH].includes(
        createCohortModeValue
      ) &&
      !this.rasToken.rasTokenValidated
    ) {
      sessionStorage.setItem(
        'dbgapRasLoginServer',
        this.fhirBackend.serviceBaseUrl
      );
      // Store user's selection so it can be restored after successful RAS connection.
      sessionStorage.setItem('selectedCreateCohortMode', createCohortModeValue);
      // Contact rdf-server for RAS login. '/rdf-server' queries are proxy forwarded
      // to rdf-server (see src/proxy.conf.json).
      window.location.href = `${window.location.origin}/rdf-server/login`;
    } else {
      this.stepper.next();
    }
  }
}
