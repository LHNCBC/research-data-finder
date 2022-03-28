import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Input,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { concatMap, map, reduce, startWith, switchMap } from 'rxjs/operators';
import { chunk } from 'lodash-es';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { MatTabGroup } from '@angular/material/tabs';
import { combineLatest, from, Observable, of, Subject } from 'rxjs';
import Patient = fhir.Patient;
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { HttpClient } from '@angular/common/http';
import { FormControl, Validators } from '@angular/forms';
import { ColumnValuesService } from '../../shared/column-values/column-values.service';
import Resource = fhir.Resource;
import Bundle = fhir.Bundle;
import Observation = fhir.Observation;
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { saveAs } from 'file-saver';
import { SearchParameterGroupComponent } from '../search-parameter-group/search-parameter-group.component';

type PatientMixin = { patientData: Patient };

/**
 * The main component for pulling Patient-related resources data
 */
@Component({
  selector: 'app-pull-data-page',
  templateUrl: './pull-data-page.component.html',
  styleUrls: ['./pull-data-page.component.less']
})
export class PullDataPageComponent implements AfterViewInit {
  @ViewChild(MatTabGroup) tabGroup: MatTabGroup;
  @ViewChildren(ResourceTableComponent)
  resourceTables: QueryList<ResourceTableComponent>;
  // Resource table data ready to download
  canDownload$: Observable<boolean>;

  // Array of visible resource type names
  visibleResourceTypes: string[];
  // Array of not visible resource type names
  unselectedResourceTypes: string[];
  // Array of resource type names that has "code text" search parameter
  codeTextResourceTypes: string[] = [];

  // Array of loaded Patients
  patients: Patient[] = [];
  // This observable is used to avoid ExpressionChangedAfterItHasBeenCheckedError
  // when the active tab changes
  currentResourceType$: Observable<string>;

  // Input stream of loaded Patients from DefineCohortComponent
  @Input() set patientStream(stream: Observable<Patient>) {
    this.resourceStream = {};
    if (stream) {
      stream
        .pipe(
          reduce((acc, patient) => {
            acc.push(patient);
            return acc;
          }, [])
        )
        .subscribe((patients) => {
          this.patients = patients;
        });
    } else {
      this.patients = [];
    }
  }

  // Stream of resources for ResourceTableComponent
  resourceStream: { [resourceType: string]: Subject<Resource> } = {};
  // Resource loading progress values for ResourceTableComponent
  progressValue: { [resourceType: string]: number } = {};
  // Form controls of 'per patient' input
  perPatientFormControls: { [resourceType: string]: FormControl } = {};

  constructor(
    private fhirBackend: FhirBackendService,
    private http: HttpClient,
    public columnDescriptions: ColumnDescriptionsService,
    private columnValues: ColumnValuesService,
    private cdr: ChangeDetectorRef
  ) {
    fhirBackend.initialized
      .pipe(map((status) => status === ConnectionStatus.Ready))
      .subscribe((connected) => {
        this.visibleResourceTypes = ['Observation'];
        this.unselectedResourceTypes = [];
        if (connected) {
          const resources = fhirBackend.getCurrentDefinitions().resources;
          this.unselectedResourceTypes = Object.keys(resources).filter(
            (resourceType) =>
              this.visibleResourceTypes.indexOf(resourceType) === -1
          );
          this.codeTextResourceTypes = Object.entries(resources)
            .filter((r: [string, any]) =>
              r[1].searchParameters.some((sp) => sp.element === 'code text')
            )
            .map((r) => r[0]);
        }
        this.perPatientFormControls = {
          Observation: new FormControl(1, [
            Validators.required,
            Validators.min(1)
          ])
        };
        this.unselectedResourceTypes.forEach((r) => {
          // Due to optimization, we cannot control the number of ResearchStudies
          // per Patient. Luckily it doesn't make much sense.
          if (r !== 'ResearchStudy' && r !== 'Patient') {
            this.perPatientFormControls[r] = new FormControl(1000, [
              Validators.required,
              Validators.min(1)
            ]);
          }
        });
      });
  }

  ngAfterViewInit(): void {
    this.currentResourceType$ = this.tabGroup.selectedTabChange.pipe(
      startWith(this.getCurrentResourceType()),
      map(() => {
        // Dispatching a resize event fixes the issue with <cdk-virtual-scroll-viewport>
        // displaying an empty table when the active tab is changed.
        // This event runs _changeListener in ViewportRuler which run checkViewportSize
        // in CdkVirtualScrollViewport.
        // See code for details:
        // https://github.com/angular/components/blob/12.2.3/src/cdk/scrolling/viewport-ruler.ts#L55
        // https://github.com/angular/components/blob/12.2.3/src/cdk/scrolling/virtual-scroll-viewport.ts#L184
        if (typeof Event === 'function') {
          // fire resize event for modern browsers
          window.dispatchEvent(new Event('resize'));
        } else {
          // for IE and other old browsers
          // causes deprecation warning on modern browsers
          const evt = window.document.createEvent('UIEvents');
          // @ts-ignore
          evt.initUIEvent('resize', true, false, window, 0);
          window.dispatchEvent(evt);
        }
        return this.getCurrentResourceType();
      })
    );
    this.canDownload$ = combineLatest([
      this.currentResourceType$,
      this.resourceTables.changes
    ]).pipe(
      switchMap(([currentResourceType]) => {
        const currentResourceTable = this.resourceTables.find(
          (resourceTable) => resourceTable.resourceType === currentResourceType
        );
        return currentResourceTable?.hasLoadedData$ || of(false);
      })
    );
  }

  /**
   * Returns plural form of resource type name.
   */
  getPluralFormOfResourceType(resourceType: string): string {
    return resourceType.replace(/(.*)(.)/, (_, $1, $2) => {
      if ($2 === 'y') {
        return $1 + 'ies';
      }
      return _ + 's';
    });
  }

  /**
   * Whether to show code selection after Load button.
   */
  showCodeSelection(resourceType: string): boolean {
    // TODO: waiting feedback from Clem whether we will show code selection for all
    // resource types with a "code text" search parameter.
    return resourceType === 'Observation';
    // return this.codeTextResourceTypes.includes(resourceType);
  }

  /**
   * Adds tab for specified resource type.
   */
  addTab(resourceType: string): void {
    this.unselectedResourceTypes.splice(
      this.unselectedResourceTypes.indexOf(resourceType),
      1
    );
    this.visibleResourceTypes.push(resourceType);
    this.tabGroup.selectedIndex = this.visibleResourceTypes.length - 1;
  }

  /**
   * Returns text for the remove tab button.
   */
  getRemoveTabButtonText(resourceType: string): string {
    return `Remove ${this.getPluralFormOfResourceType(resourceType)} tab`;
  }

  /**
   * Removes tab for specified resource type.
   */
  removeTab(resourceType: string): void {
    this.unselectedResourceTypes.push(resourceType);
    this.unselectedResourceTypes.sort();
    const removeIndex = this.visibleResourceTypes.indexOf(resourceType);
    if (removeIndex && removeIndex === this.tabGroup.selectedIndex) {
      this.tabGroup.selectedIndex--;
    }
    this.visibleResourceTypes.splice(removeIndex, 1);
  }

  /**
   * Returns resourceType for the selected tab
   */
  getCurrentResourceType(): string {
    return this.visibleResourceTypes[this.tabGroup.selectedIndex];
  }

  /**
   * Opens a dialog for configuring resource table columns.
   */
  configureColumns(): void {
    this.columnDescriptions.openColumnsDialog(
      this.getCurrentResourceType(),
      'pull-data'
    );
  }

  /**
   * Loads resources of the specified type for a cohort of Patients.
   * @param resourceType - resource type
   * @param parameterGroup - component for managing search parameters of the resource type
   */
  loadResources(
    resourceType: string,
    parameterGroup: SearchParameterGroupComponent
  ): void {
    if (parameterGroup.hasErrors()) {
      parameterGroup.showErrors();
      return;
    }
    let criteria = parameterGroup.getConditions().criteria;
    this.resourceStream[resourceType] = new Subject<Resource>();
    this.progressValue[resourceType] = 0;

    // Added "detectChanges" to prevent this issue:
    // If queries are cached, then the values will be sent to the Subject
    // before the ResourceTableComponent subscribes to the resource stream.
    this.cdr.detectChanges();

    const observationCodes = [];
    const patientToCodeToCount = {};
    let sortParam = '';

    if (resourceType === 'Observation') {
      criteria = criteria.replace(/&combo-code=([^&]*)/g, (_, $1) => {
        observationCodes.push(...$1.split(','));
        return '';
      });

      const sortFields = observationCodes.length ? [] : ['code'];
      if (this.fhirBackend.features.sortObservationsByDate) {
        sortFields.push('-date');
      } else if (this.fhirBackend.features.sortObservationsByAgeAtEvent) {
        sortFields.push('-age-at-event');
      }
      sortParam = '&_sort=' + sortFields.join(',');
    }

    // To optimize Patient loading, we load them for 10 Patients
    // in one query. We don't use this optimization for other resource types
    // because we need to limit the number of resources per Patient.
    const numberOfPatientsInRequest = resourceType === 'Patient' ? 10 : 1;
    from(
      [].concat(
        ...chunk(this.patients, numberOfPatientsInRequest).map((patients) => {
          let linkToPatient;

          if (resourceType === 'ResearchStudy') {
            linkToPatient = `_has:ResearchSubject:study:individual=${patients
              .map((patient) => patient.id)
              .join(',')}`;
          } else if (resourceType === 'Patient') {
            linkToPatient = `_id=${patients
              .map((patient) => patient.id)
              .join(',')}`;
          } else {
            linkToPatient = `subject=${patients
              .map((patient) => 'Patient/' + patient.id)
              .join(',')}`;
          }

          if (observationCodes.length) {
            // Create separate requests for each Observation code
            return observationCodes.map((code) => {
              return (
                this.http
                  .get(
                    `$fhir/${resourceType}?${linkToPatient}${criteria}${sortParam}&_count=${this.perPatientFormControls.Observation.value}&combo-code=${code}`
                  )
                  // toPromise needed to immediately execute query, this allows batch requests
                  .toPromise()
                  .then((bundle) => ({
                    bundle,
                    patientData: patients.length === 1 ? patients[0] : null
                  }))
              );
            });
          }

          const countParam =
            resourceType === 'Observation' ||
            !this.perPatientFormControls[resourceType]
              ? '&_count=1000'
              : `&_count=${this.perPatientFormControls[resourceType].value}`;
          return (
            this.http
              .get(
                `$fhir/${resourceType}?${linkToPatient}${criteria}${sortParam}${countParam}`
              )
              // toPromise needed to immediately execute FhirBackendService.handle, this allows batch requests
              .toPromise()
              .then((bundle) => ({
                bundle,
                patientData: patients.length === 1 ? patients[0] : null
              }))
          );
        })
      )
    )
      .pipe(
        concatMap(
          (
            bundlePromise: Promise<{ bundle: Bundle; patientData: Patient }>
          ) => {
            return from(bundlePromise);
            // TODO: Currently we load only 1000 resources per Patient.
            //       (In the previous version of Research Data Finder,
            //       we only loaded the first page with the default size)
            //       Uncommenting the below code will allow loading all resources,
            //       but this could take time.
            /*.pipe(
            // Modifying the Observable to load the following pages sequentially
            expand((response: Bundle) => {
              const nextPageUrl = getNextPageUrl(response);
              if (nextPageUrl) {
                return from(this.http.get(nextPageUrl).toPromise());
              } else {
                // Emit a complete notification
                return EMPTY;
              }
            })
          )*/
          }
        ),

        // Generate a sequence of resources
        concatMap(({ bundle, patientData }) => {
          // Update progress indicator
          this.progressValue[resourceType] +=
            (numberOfPatientsInRequest * 100) /
            (this.patients.length * (observationCodes.length || 1));

          const res: (Resource & PatientMixin)[] =
            bundle?.entry?.map((entry) => ({
              ...entry.resource,
              patientData
            })) || [];

          if (resourceType === 'Observation' && !observationCodes.length) {
            // When no code is specified in criteria and we loaded last 1000 Observations.
            // Per Clem, we will only show perPatientPerTest results per patient per test.
            const perPatientPerTest = this.perPatientFormControls.Observation
              .value;
            return res.filter((obs: Observation & PatientMixin) => {
              const patientRef = obs.subject.reference;
              const codeStr = this.columnValues.getCodeableConceptAsText(
                obs.code
              );
              const codeToCount =
                patientToCodeToCount[patientRef] ||
                (patientToCodeToCount[patientRef] = {});

              // For now skip Observations without a code in the first coding.
              if (codeStr) {
                const codeCount =
                  codeToCount[codeStr] || (codeToCount[codeStr] = 0);
                if (codeCount < perPatientPerTest) {
                  ++codeToCount[codeStr];
                  return true;
                }
              }
              return false;
            });
          }

          return res;
        })
      )
      // Sequentially send the loaded resources to the resource table
      .subscribe(this.resourceStream[resourceType]);
  }

  /**
   * Initiates downloading of resourceTable data in CSV format.
   */
  downloadCsv(): void {
    const currentResourceType = this.getCurrentResourceType();
    const currentResourceTable = this.resourceTables.find(
      (resourceTable) => resourceTable.resourceType === currentResourceType
    );
    saveAs(
      currentResourceTable.getBlob(),
      this.getPluralFormOfResourceType(currentResourceType).toLowerCase() +
        '.csv'
    );
  }
}
