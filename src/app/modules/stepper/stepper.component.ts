import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
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
import { SelectRecordsService } from '../../shared/select-records/select-records.service';
import { RasTokenService } from '../../shared/ras-token/ras-token.service';
import { SelectRecordsPageComponent } from '../select-records-page/select-records-page.component';
import { SelectAnActionComponent } from '../select-an-action/select-an-action.component';
import { SettingsPageComponent } from '../step-0-settings-page/settings-page.component';
import Patient = fhir.Patient;
import { first } from 'rxjs/operators';
import { CartService } from '../../shared/cart/cart.service';

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
export class StepperComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stepper') public stepper: MatStepper;
  @ViewChild('settings') public settingsPageComponent: SettingsPageComponent;
  @ViewChild('settingsStep') public settingsStep: MatStep;

  @ViewChild('defineCohortStep') set _defineCohortStep(step: MatStep) {
    this.defineCohortStep = step;
    if (step) {
      step.completed = false;
    }
  }
  defineCohortStep: MatStep;

  @ViewChild('selectRecordsStep') set _selectRecordsStep(step: MatStep) {
    this.selectRecordsStep = step;
    if (step) {
      step.completed = false;
    }
  }
  selectRecordsStep: MatStep;

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

  defineCohort: UntypedFormControl = new UntypedFormControl();
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

  // Enable RAS if it is not disabled via the URL parameter
  enableRas = getUrlParam('ras') !== 'disable';

  // A counter used to navigate to the previous step after RAS login
  rasStepCountDown = 0;

  constructor(
    public columnDescriptions: ColumnDescriptionsService,
    public fhirBackend: FhirBackendService,
    public cohort: CohortService,
    public pullData: PullDataService,
    public selectRecord: SelectRecordsService,
    public rasToken: RasTokenService,
    private cart: CartService
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
  }

  ngOnInit() {
    this.fhirBackend.dbgapRelogin$.pipe(first()).subscribe(() => {
      const savedObject = this.getSavedObject();
      sessionStorage.setItem('savedObject', JSON.stringify(savedObject));
      const currentStep = this.getCurrentStep();
      if (currentStep === Step.PULL_DATA_FOR_THE_COHORT.toString()) {
        // Save which tabs user has opened and related form controls if in "pull data" step.
        const pullDataStatus = this.pullDataPageComponent.getReloginStatus();
        sessionStorage.setItem(
          'pullDataStatus',
          JSON.stringify(pullDataStatus)
        );
      }
      if (
        currentStep === Step.VIEW_COHORT.toString() &&
        this.cohort.patient400ErrorFlag
      ) {
        // In case of 4xx error while searching for patients, re-login the user to the
        // previous step and go to "view cohort" step with an actual search for patients.
        this.cohort.patient400ErrorFlag = false;
        this.rasToken.login(
          this.fhirBackend.serviceBaseUrl,
          this.selectAnActionComponent.createCohortMode.value,
          this.stepper.selectedIndex - 1,
          true
        );
      } else {
        this.rasToken.login(
          this.fhirBackend.serviceBaseUrl,
          this.selectAnActionComponent.createCohortMode.value,
          this.stepper.selectedIndex,
          false
        );
      }
    });
  }

  /**
   * A lifecycle hook that is called after Angular has fully initialized
   * a component's view.
   */
  ngAfterViewInit(): void {
    this.subscription = this.fhirBackend.initialized.subscribe((status) => {
      if (
        status === ConnectionStatus.Disconnect ||
        status === ConnectionStatus.Pending
      ) {
        this.stepper.reset();
        // A workaround for the bug which is described here:
        // https://github.com/angular/components/issues/13736
        // The problem is with [completed] input parameter which is ignored
        // after reset(), because the actual completed value is set directly here:
        // https://github.com/angular/components/blob/12.2.x/src/cdk/stepper/stepper.ts#L217
        // Another way is not to use [completed]="expression" in our template at
        // all and always set this value directly. But this requires significant
        // changes. So I decided to do it only here:
        this.settingsStep.completed = this.settingsPageComponent.settingsFormGroup.valid;
      } else if (status === ConnectionStatus.Ready) {
        this.allowChangeCreateCohortMode = this.fhirBackend.isAlphaVersion;
        if (!this.allowChangeCreateCohortMode) {
          this.cohort.createCohortMode = CreateCohortMode.SEARCH;
        } else {
          if (
            !this.rasToken.rasTokenValidated ||
            !this.rasToken.isRasCallbackNavigation
          ) {
            this.cohort.createCohortMode = CreateCohortMode.UNSELECTED;
            this.selectAnActionComponent?.createCohortMode.setValue(
              CreateCohortMode.UNSELECTED
            );
          } else {
            this.rasToken.isRasCallbackNavigation = false;
            this.rasStepCountDown = Number(
              sessionStorage.getItem('currentStepperIndex')
            );
            const goNextStep = sessionStorage.getItem('goNextStep') === 'true';
            if (this.rasStepCountDown) {
              setTimeout(() => {
                this.stepper.next();
                this.rasStepCountDown--;
                // If it came from '/request-redirect-token-callback' and RAS token
                // has been validated, go back to Select An Action step and restore
                // user's selection before contacting RAS.
                const selectedCreateCohortMode = sessionStorage.getItem(
                  'selectedCreateCohortMode'
                ) as CreateCohortMode;
                this.selectAnActionComponent.createCohortMode.setValue(
                  selectedCreateCohortMode
                );
                if (this.rasStepCountDown === 0) {
                  this.checkNextStep(goNextStep);
                } else {
                  setTimeout(() => {
                    this.stepper.next();
                    this.rasStepCountDown--;
                    const savedObject = sessionStorage.getItem('savedObject');
                    if (savedObject) {
                      this.loadFromRawCriteria(JSON.parse(savedObject));
                    }
                    if (this.rasStepCountDown === 0) {
                      this.checkNextStep(goNextStep);
                    } else {
                      setTimeout(() => {
                        this.stepper.next();
                        const pullDataStatus = sessionStorage.getItem(
                          'pullDataStatus'
                        );
                        const currentStep = this.getCurrentStep();
                        if (
                          currentStep ===
                            Step.PULL_DATA_FOR_THE_COHORT.toString() &&
                          pullDataStatus
                        ) {
                          this.pullDataPageComponent.restoreLoginStatus(
                            JSON.parse(pullDataStatus)
                          );
                        }
                      }, 200);
                    }
                  }, 0);
                }
              }, 0);
            }
          }
        }
      }
    });
  }

  /**
   * If applicable, go to the next step after user's previous step is restored.
   * @param goNextStep
   * @private
   */
  private checkNextStep(goNextStep: boolean): void {
    if (!goNextStep) {
      return;
    }
    setTimeout(() => {
      const currentStep = this.getCurrentStep();
      if (currentStep === Step.DEFINE_COHORT.toString()) {
        // call searchForPatients() to go to "view cohort" step with an actual search.
        this.searchForPatients();
      } else {
        this.stepper.next();
      }
    }, 200);
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
    const objectToSave = this.getSavedObject();
    const blob = new Blob([JSON.stringify(objectToSave, null, 2)], {
      type: 'text/json;charset=utf-8',
      endings: 'native'
    });
    saveAs(blob, `cohort-${objectToSave.data.length}.json`);
  }

  /**
   * Get the object to be saved, either to a file or to sessionStorage.
   */
  getSavedObject(): any {
    const result: any = {
      version: pkg.version,
      serviceBaseUrl: this.fhirBackend.serviceBaseUrl,
      maxPatientCount: this.cohort.maxPatientCount,
      rawCriteria: this.cohort.criteria,
      cartCriteria: this.cart.getCartCriteria(),
      additionalCriteria: this.selectRecordsComponent?.additionalCriteria
        ?.value,
      researchStudies:
        this.selectAreaOfInterestComponent?.getResearchStudySearchParam() ?? []
    };
    const currentStep = this.getCurrentStep();
    // Save Patient table data if user is at "view cohort" or "pull data" step.
    // Do not save patients data as empty array if 4xx error happened during patient search.
    if (
      (currentStep === Step.VIEW_COHORT.toString() &&
        !this.cohort.patient400ErrorFlag) ||
      currentStep === Step.PULL_DATA_FOR_THE_COHORT.toString()
    ) {
      result.data =
        this.viewCohortComponent?.resourceTableComponent?.dataSource?.data.map(
          (i) => i.resource
        ) ?? [];
    }
    return result;
  }

  /**
   * Find which step user is at.
   */
  getCurrentStep(): string {
    return Object.keys(Step).find(
      (s) => this.stepDescriptions[s].label === this.stepper.selected.label
    );
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
          this.loadFromRawCriteria(blobData, fromResearchStudyStep, filename);
        } catch (e) {
          alert('Error: ' + e.message);
        }
      };
      reader.readAsText(event.target.files[0]);
    }
    event.target.value = '';
  }

  /**
   * Load cohort from raw criteria data.
   */
  loadFromRawCriteria(
    rawData: any,
    fromResearchStudyStep = false,
    filename = null
  ): void {
    const {
      version,
      serviceBaseUrl,
      maxPatientCount,
      rawCriteria,
      cartCriteria,
      additionalCriteria,
      data,
      researchStudies
    } = rawData;
    if (serviceBaseUrl !== this.fhirBackend.serviceBaseUrl) {
      alert(
        'Error: Inapplicable data, because it was downloaded from another server.'
      );
      return;
    }
    const isCartApproach =
      this.getCurrentStep() === Step.SELECT_RECORDS.toString();
    if (isCartApproach) {
      // Set max field value.
      this.selectRecordsComponent.maxPatientsNumber.setValue(maxPatientCount);
      // Restore resources, controls and lookups in carts and in 'Additional Criteria' tab.
      this.selectRecordsComponent.setCartCriteria(
        cartCriteria,
        additionalCriteria
      );
    } else {
      // Set max field value.
      this.defineCohortComponent.defineCohortForm
        .get('maxNumberOfPatients')
        .setValue(maxPatientCount);
      // Update criteria object if the cohort was downloaded from an older version.
      if (!version) {
        this.cohort.updateOldFormatCriteria(rawCriteria);
      }
      // Set search parameter form values.
      this.defineCohortComponent.patientParams.queryCtrl.setValue(rawCriteria);
      this.cohort.criteria$.next(rawCriteria);
      // Set selected research studies.
      this.selectAreaOfInterestComponent?.selectLoadedResearchStudies(
        researchStudies
      );
    }
    if (data) {
      // Set patient table data, if it was saved.
      this.loadPatientsData(data, fromResearchStudyStep, isCartApproach);
      this.cohort.loadingStatistics = filename
        ? [[`Data loaded from file ${filename}.`]]
        : [[`Data reloaded from session storage.`]];
    }
  }

  /**
   * Re-populate the patient table
   * @private
   */
  private loadPatientsData(
    data: Patient[],
    fromResearchStudyStep = false,
    isCartApproach = false
  ): void {
    if (isCartApproach) {
      this.selectRecordsStep.completed = true;
    } else {
      this.defineCohortStep.completed = true;
    }
    const patientStream = new Subject<Patient[]>();
    this.cohort.patientStream = patientStream.asObservable();
    setTimeout(() => {
      this.stepper.next();
      if (this.rasStepCountDown) {
        this.rasStepCountDown--;
      }
      if (fromResearchStudyStep) {
        this.stepper.next();
      }
      setTimeout(() => {
        this.cohort.currentState.patients = data;
        patientStream.next(data);
        patientStream.complete();
      });
    }, 100);
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
      this.rasToken.login(
        this.fhirBackend.serviceBaseUrl,
        createCohortModeValue
      );
    } else {
      this.stepper.next();
    }
  }
}
