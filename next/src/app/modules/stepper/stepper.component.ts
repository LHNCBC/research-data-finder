import { Component, OnDestroy, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { filter, take } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { DefineCohortPageComponent } from '../step-2-define-cohort-page/define-cohort-page.component';

import Resource = fhir.Resource;

/**
 * The main component provides a wizard-like workflow by dividing content into logical steps.
 */
@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.component.html',
  styleUrls: ['./stepper.component.less']
})
export class StepperComponent implements OnDestroy {
  @ViewChild('stepper') private myStepper: MatStepper;
  @ViewChild(DefineCohortPageComponent) public defineCohortComponent;

  settings: FormControl = new FormControl();
  defineCohort: FormControl = new FormControl();
  serverInitialized = false;
  subscription: Subscription;
  PATIENT = 'Patient';
  patientStream = new Subject<Resource>();

  constructor(
    public columnDescriptions: ColumnDescriptionsService,
    private fhirBackend: FhirBackendService
  ) {
    this.subscription = fhirBackend.initialized
      .pipe(
        filter((status) => status === ConnectionStatus.Ready),
        take(1)
      )
      .subscribe(() => {
        this.serverInitialized = true;
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.columnDescriptions.destroy();
  }

  searchForPatients(): void {
    const resourceSummaries = this.defineCohortComponent.getConditions();
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
        const maxPatientCount = this.defineCohortComponent.defineCohortForm
          .value.maxPatientsNumber;
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
  }

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
        console.log(result);
        this.patientStream.next(result);
        return result;
      });
  }
}
