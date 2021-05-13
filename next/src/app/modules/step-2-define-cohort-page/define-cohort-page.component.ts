import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import {
  BaseControlValueAccessorAndValidator,
  createControlValueAccessorAndValidatorProviders
} from '../base-control-value-accessor';
import { SearchParametersComponent } from '../search-parameters/search-parameters.component';
import { SearchCondition } from '../../types/search.condition';
import { Subject } from 'rxjs';
import Resource = fhir.Resource;
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';

/**
 * Component for defining criteria to build a cohort of Patient resources.
 */
@Component({
  selector: 'app-define-cohort-page',
  templateUrl: './define-cohort-page.component.html',
  styleUrls: ['./define-cohort-page.component.less'],
  providers: createControlValueAccessorAndValidatorProviders(
    DefineCohortPageComponent
  )
})
export class DefineCohortPageComponent
  extends BaseControlValueAccessorAndValidator<any>
  implements OnInit {
  defineCohortForm: FormGroup;
  PATIENT = 'Patient';
  patientStream: Subject<Resource>;

  @ViewChild('patientParams') patientParams: SearchParametersComponent;

  constructor(
    private formBuilder: FormBuilder,
    private fhirBackend: FhirBackendService
  ) {
    super();
  }

  ngOnInit(): void {
    this.defineCohortForm = this.formBuilder.group({
      maxPatientsNumber: ['100', Validators.required]
    });
    this.defineCohortForm.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  validate({ value }: FormControl): ValidationErrors | null {
    return this.defineCohortForm.get('maxPatientsNumber').errors;
  }

  writeValue(obj: any): void {}

  addParameter(): void {
    this.patientParams.addParameter();
  }

  /**
   * get all search parameters, grouped by resource types.
   */
  getConditions(): SearchCondition[] {
    return this.patientParams.getConditions();
  }

  /**
   * Search for a list of patient resources using search parameters.
   * This method gathers all search parameters,
   * searches from server and checks patient records against all search parameters,
   * and emits patient records that matches all search parameters through {patientStream}
   */
  searchForPatients(): void {
    // make new stream so user can come back and search multiple times
    this.patientStream = new Subject<Resource>();
    setTimeout(() => {
      const resourceSummaries = this.getConditions();
      // Load resource summaries
      Promise.all(
        resourceSummaries.length > 1
          ? resourceSummaries.map((item) =>
              this.fhirBackend.getWithCache(
                `${item.resourceType}?_total=accurate&_summary=count${item.criteria}`
              )
            )
          : []
      ).then((summaries: any[]) => {
        // Sort by the number of resources matching the conditions
        if (summaries.length > 0) {
          resourceSummaries.forEach((resourceSummary, index) => {
            resourceSummary.total = summaries[index].data.total;
          });
          resourceSummaries.sort((x, y) => x.total - y.total);
        }

        if (resourceSummaries[0].total === 0) {
          return { entry: [] };
        } else {
          // Hashmap of processed patients. Used to avoid recheck of the same patient
          const processedPatients = {};
          // Resource summary from which the search starts
          const firstItem = resourceSummaries.shift();
          const maxPatientCount = this.defineCohortForm.value.maxPatientsNumber;
          const elements = 'name';

          if (firstItem.resourceType === 'ResearchStudy') {
            // If the search starts from ResearchStudy
            return this.fhirBackend.fhirClient.resourcesMapFilter(
              `ResearchStudy?_elements=id${firstItem.criteria}`,
              maxPatientCount,
              (researchStudy) => {
                // Map each ResearchStudy to ResearchSubjects
                return this.fhirBackend.fhirClient.resourcesMapFilter(
                  `ResearchSubject?_elements=individual&study=${researchStudy.id}`,
                  maxPatientCount,
                  (researchSubject) => {
                    // Map each ResearchSubject to Patient Id
                    const patientId =
                      /^Patient\/(.*)/.test(
                        researchSubject.individual.reference
                      ) && RegExp.$1;
                    if (processedPatients[patientId]) {
                      return false;
                    }
                    processedPatients[patientId] = true;
                    // And filter by rest of the criteria
                    return this.checkPatient(
                      resourceSummaries,
                      elements,
                      maxPatientCount,
                      patientId
                    );
                  },
                  maxPatientCount
                );
              },
              1
            );
          }

          // List of resource elements for the first request
          const firstItemElements =
            firstItem.resourceType === this.PATIENT ? elements : 'subject';

          // If the search doesn't start from ResearchStudy
          return this.fhirBackend.fhirClient
            .resourcesMapFilter(
              `${firstItem.resourceType}?_elements=${firstItemElements}${firstItem.criteria}`,
              maxPatientCount,
              (resource) => {
                // Map each resource to Patient Id
                let patientResource;
                let patientId;
                if (resource.resourceType === this.PATIENT) {
                  patientResource = resource;
                  patientId = patientResource.id;
                } else {
                  patientId =
                    /^Patient\/(.*)/.test(resource.subject.reference) &&
                    RegExp.$1;
                }
                if (processedPatients[patientId]) {
                  return false;
                }
                processedPatients[patientId] = true;
                // And filter Patient by rest of the criteria
                return this.checkPatient(
                  resourceSummaries,
                  elements,
                  maxPatientCount,
                  patientId,
                  patientResource
                );
              },
              resourceSummaries.length > 1 ? null : maxPatientCount
            )
            .then(() => {
              this.patientStream.complete();
            });
        }
      });
    });
  }

  /**
   * Checks the patient for the rest of the criteria and returns promise fulfilled
   * with Patient resource data or with false.
   * @param resourceSummaries - array of Object describes criteria
   *   for each resource
   * @param elements - value of the _element parameter to use
   *   in the query to retrieve Patient data
   * @param maxPatientCount - maximum number of Patients
   * @param patientId - Patient id
   * @param [patientResource] - Patient resource data
   */
  checkPatient(
    resourceSummaries,
    elements,
    maxPatientCount,
    patientId,
    patientResource = null
  ): void {
    return resourceSummaries
      .reduce(
        (promise, item) =>
          promise.then((result) => {
            if (!result) {
              return result;
            }
            let url;

            if (item.resourceType === this.PATIENT) {
              url = `${item.resourceType}?_elements=${elements}${item.criteria}&_id=${patientId}`;
            } else if (item.resourceType === 'ResearchStudy') {
              url = `${item.resourceType}?_total=accurate&_summary=count${item.criteria}&_has:ResearchSubject:study:individual=Patient/${patientId}`;
            } else {
              url = `${item.resourceType}?_total=accurate&_summary=count${item.criteria}&subject:Patient=${patientId}`;
            }

            return this.fhirBackend.getWithCache(url).then(({ data }) => {
              const meetsTheConditions = data.total > 0;
              const resource =
                data.entry && data.entry[0] && data.entry[0].resource;
              if (resource && resource.resourceType === this.PATIENT) {
                patientResource = resource;
              }

              return meetsTheConditions && patientResource
                ? patientResource
                : meetsTheConditions;
            });
          }),
        Promise.resolve(patientResource ? patientResource : true)
      )
      .then((result) => {
        if (result) {
          this.patientStream.next(result);
        }
      });
  }
}
