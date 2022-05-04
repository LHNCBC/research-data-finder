/**
 * This file contains a service for working with a cohort of patients.
 */
import { Injectable } from '@angular/core';
import {
  Criteria,
  Criterion,
  ResourceTypeCriteria
} from '../../types/search-parameters';
import {
  BehaviorSubject,
  EMPTY,
  forkJoin,
  from,
  Observable,
  of,
  OperatorFunction,
  Subject
} from 'rxjs';
import {
  bufferCount,
  catchError,
  concatMap,
  expand,
  filter,
  finalize,
  map,
  mergeMap,
  share,
  startWith,
  switchMap,
  take,
  tap
} from 'rxjs/operators';
import Resource = fhir.Resource;
import {
  CODETEXT,
  OBSERVATION_VALUE,
  QueryParamsService
} from '../query-params/query-params.service';
import { uniqBy } from 'lodash-es';
import { getNextPageUrl } from '../utils';
import Bundle = fhir.Bundle;
import { HttpClient } from '@angular/common/http';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';

// Patient resource type name
const PATIENT_RESOURCE_TYPE = 'Patient';
// ResearchStudy resource type name
const RESEARCH_STUDY_RESOURCE_TYPE = 'ResearchStudy';
// EvidenceVariable resource type name
const EVIDENCE_VARIABLE_RESOURCE_TYPE = 'EvidenceVariable';
// Observation resource type name
const OBSERVATION_RESOURCE_TYPE = 'Observation';

@Injectable({
  providedIn: 'root'
})
export class CohortService {
  constructor(
    private fhirBackend: FhirBackendService,
    private queryParams: QueryParamsService,
    private http: HttpClient
  ) {}

  // Observable that emits Patient resources that match the criteria
  patientStream: Observable<Resource>;

  // Cohort criteria
  criteria: Criteria;
  criteria$ = new Subject<Criteria>();

  // Maximum number of patients
  maxPatientCount = 100;

  // A matrix of loading info that will be displayed with View Cohort resource table.
  loadingStatistics: (string | number)[][] = [];

  // Number of matched Patients
  patientCount = 0;

  // Processed Patient Ids used to skip already selected Patients
  processedPatientIds: { [patientId: string]: boolean };

  // The number of resources in processing is used to pause the loading of the next page
  numberOfProcessingResources$: BehaviorSubject<number>;

  /**
   * Sets the cohort criteria
   */
  setCriteria(criteria: Criteria): void {
    this.criteria = criteria;
    this.criteria$.next(criteria);
  }

  /**
   * Resets the cohort criteria to its default value and returns that value
   */
  resetCriteria(): Criteria {
    const defaultCriteria: Criteria = {
      condition: 'and',
      rules: []
    };
    this.setCriteria(defaultCriteria);
    return defaultCriteria;
  }
  /**
   * Search for a list of Patient resources using the criteria tree.
   * This method searches from the server and checks Patient resources
   * against all criteria, and emits Patient resources that match criteria
   * through {patientStream}
   */
  searchForPatients(
    criteria: Criteria,
    maxPatientCount: number,
    researchStudyIds: string[] = null
  ): void {
    this.loadingStatistics = [];
    this.maxPatientCount = maxPatientCount;
    // Maximum number of Patients to load
    const emptyPatientCriteria: ResourceTypeCriteria = {
      condition: 'and',
      resourceType: PATIENT_RESOURCE_TYPE,
      rules: []
    };

    this.setCriteria(criteria);

    // Preprocess a criteria tree built using the Query Builder component.
    // If there are no criteria - use default empty Patient criteria.
    criteria = (this.prepareCriteria(criteria, researchStudyIds) ||
      emptyPatientCriteria) as Criteria;

    // Reset the number of matched Patients
    this.patientCount = 0;
    this.processedPatientIds = {};
    this.numberOfProcessingResources$ = new BehaviorSubject<number>(0);

    // Create a new Observable which emits Patient resources that match the criteria.
    // If we have only one block with Patient criteria - load all Patient in one request.
    this.patientStream = this.search(
      maxPatientCount,
      criteria,
      this.isOnlyOneBlockWithPatientCriteria(criteria)
        ? maxPatientCount
        : this.getPageSize()
    ).pipe(
      // Expand each array of resources into separate resources
      concatMap((resources) => from(resources)),
      // Skip already processed Patients
      filter((resource) => {
        const patientId = this.getPatientIdFromResource(resource);
        if (this.processedPatientIds[patientId]) {
          // Update the number of resources in processing
          this.numberOfProcessingResources$.next(
            this.numberOfProcessingResources$.value - 1
          );
          return false;
        }
        this.processedPatientIds[patientId] = true;
        return true;
      }),
      // Stop emitting resources when the maximum number is reached
      take(maxPatientCount),
      // If the found resource isn't a Patient (when no criteria for Patients),
      // replace it with a Patient
      mergeMap((resource) => {
        if (resource.resourceType === PATIENT_RESOURCE_TYPE) {
          return of(resource);
        }

        // The check function replaces the resource with the Patient resource
        // if there are criteria for the patient
        return this.check(resource, emptyPatientCriteria);
      }),
      tap(() => {
        // Increment the number of matched Patients
        this.patientCount++;
        if (this.patientCount < maxPatientCount) {
          // Update the number of resources in processing
          this.numberOfProcessingResources$.next(
            this.numberOfProcessingResources$.value - 1
          );
        } else {
          // Cancel the loading of the next page if the maximum number of
          // Patients has been reached
          this.numberOfProcessingResources$.next(0);
          this.numberOfProcessingResources$.complete();
        }
      }),
      // Complete observable on error
      catchError(() => EMPTY),
      // Do not create a new stream for each subscription
      share()
    );
  }

  /**
   * Returns an Observable that emits arrays of resources (page by page) that
   * match the criteria. If among the criteria there are criteria for Patients,
   * then the Observable will emit arrays of Patient resources.
   * @param maxPatientCount -
   * @param criteria - criteria tree
   * @param pageSize - the value of the _count parameter
   */
  search(
    maxPatientCount: number,
    criteria: Criteria | ResourceTypeCriteria,
    pageSize: number
  ): Observable<Resource[]> {
    // Loading resources by criteria for specified resource type
    if ('resourceType' in criteria) {
      // If the resource criteria are combined by the OR operator, we split them
      // into separate ones. ANDed criteria will be sent in one request.
      return from(
        criteria.condition === 'or'
          ? criteria.rules.map((rule) => [rule])
          : [criteria.rules]
      ).pipe(
        // Sequentially execute queries and put the result into the stream.
        concatMap((rules) =>
          this.requestResources(
            criteria.resourceType,
            rules,
            pageSize,
            maxPatientCount
          )
        )
      );
      // Loading a subgroup of resources by criteria combined by the OR operator
    } else if (criteria.condition === 'or') {
      return from(criteria.rules).pipe(
        concatMap((rule) => this.search(maxPatientCount, rule, pageSize))
      );
    } else {
      // Loading a subgroup of resources by criteria combined by the AND operator
      if (criteria.rules.length > 1) {
        // Get new criteria sorted by the number of matching resources.
        return this.getAmountOfResources(criteria).pipe(
          mergeMap((newCriteria) => {
            // If there are no matching resources, return an empty result
            if (newCriteria.total === 0) {
              return from([]);
            }
            // All child criteria except the first one
            const restRules = newCriteria.rules.slice(1);
            // Search by the first child criterion
            return this.search(
              maxPatientCount,
              newCriteria.rules[0],
              pageSize
            ).pipe(
              mergeMap((resources: Resource[]) => {
                // Exclude processed and duplicate resources
                const uncheckedResources = (uniqBy(
                  resources,
                  this.getPatientIdFromResource
                ) as Resource[]).filter(
                  (resource) =>
                    !this.processedPatientIds[
                      this.getPatientIdFromResource(resource)
                    ]
                );

                // Run a parallel check of the accumulated resources by the rest
                // of the criteria:
                return (uncheckedResources.length
                  ? forkJoin(
                      uncheckedResources.map((resource) =>
                        this.check(resource, {
                          ...newCriteria,
                          rules: restRules
                        }).pipe(startWith(null as Resource))
                      )
                    )
                  : of([])
                ).pipe(
                  map((r: Resource[]) => {
                    const checkedResources = r.filter((resource) => !!resource);
                    // Update the number of resources in processing
                    this.numberOfProcessingResources$.next(
                      this.numberOfProcessingResources$.value -
                        (resources.length - checkedResources.length)
                    );
                    return checkedResources;
                  })
                );
              })
            );
          })
        );
      } else {
        return this.search(maxPatientCount, criteria.rules[0], pageSize);
      }
    }
  }

  /**
   * Checks if the Patient related to the specified resource meets the specified
   * criteria. Returns an Observable that emits resource that match the criteria.
   * If among the criteria there are criteria for Patients or the input resource
   * is the Patient, then the Observable will emit Patient resource.
   */
  check(
    resource: Resource,
    criteria: Criteria | ResourceTypeCriteria
  ): Observable<Resource> {
    const patientId = this.getPatientIdFromResource(resource);

    if ('resourceType' in criteria) {
      // If the resource criteria are combined by the OR operator, we split them
      // into separate ones. ANDed criteria will be sent in one request.
      return from(
        criteria.condition === 'or'
          ? criteria.rules.map((rule) => [rule])
          : [criteria.rules]
      ).pipe(
        // Sequentially execute queries and put the result into the stream
        concatMap((rules) => {
          const useHas = this.canUseHas(criteria.resourceType, rules);
          const resourceType =
            criteria.resourceType === EVIDENCE_VARIABLE_RESOURCE_TYPE
              ? OBSERVATION_RESOURCE_TYPE
              : useHas
              ? PATIENT_RESOURCE_TYPE
              : criteria.resourceType;
          // If the resource is not a Patient, we extract only the subject
          // element in order to further identify the Patient by it.
          const elements =
            (resourceType === RESEARCH_STUDY_RESOURCE_TYPE &&
              '&_elements=id') ||
            (resourceType !== PATIENT_RESOURCE_TYPE && '&_elements=subject') ||
            '';

          const link =
            (resourceType === PATIENT_RESOURCE_TYPE && `_id=${patientId}`) ||
            (resourceType === RESEARCH_STUDY_RESOURCE_TYPE &&
              `_count=1&_has:ResearchSubject:study:individual=Patient/${patientId}`) ||
            `_count=1&subject:Patient=${patientId}`;
          const query =
            `$fhir/${resourceType}?${link}${elements}` +
            rules
              .map((criterion: Criterion) => {
                const urlParamString = this.queryParams.getQueryParam(
                  criteria.resourceType,
                  criterion.field
                );
                return useHas
                  ? urlParamString.replace(
                      /&/g,
                      `&_has:${criteria.resourceType}:subject:`
                    )
                  : urlParamString;
              })
              .join('');
          return this.http.get<Bundle>(query).pipe(
            map((response) => {
              if (!response?.entry?.length) {
                return null;
              }
              return response.entry[0].resource.resourceType ===
                PATIENT_RESOURCE_TYPE
                ? response.entry[0].resource
                : resource;
            })
          );
        }),
        // If the resource criteria are combined by the OR operator, we will
        // take the first matched resource:
        filter((r) => r !== null),
        take(1)
      );
    } else if (criteria.condition === 'or') {
      return from(criteria.rules).pipe(
        concatMap((rule) => this.check(resource, rule)),
        filter((r) => r !== null),
        take(1)
      );
    } else {
      if (criteria.rules.length > 1) {
        return forkJoin(
          criteria.rules.map((rule) =>
            this.check(resource, rule).pipe(startWith(null as Resource))
          )
        ).pipe(
          map((resources) => {
            if (resources.indexOf(null) !== -1) {
              return null;
            }
            const pat = resources.find(
              (r) => r.resourceType === PATIENT_RESOURCE_TYPE
            );
            return pat || resource;
          })
        );
      } else {
        return this.check(resource, criteria.rules[0]);
      }
    }
  }

  /**
   * Returns a prepared criteria tree:
   *  - removes empty criteria from the criteria tree
   *  - inserts the criteria for the selected ResearchStudies into the existing
   *    (ANDed with other) Patients criteria, otherwise adds the root criteria
   *    for the selected ResearchStudies
   *  - combine code and value criteria for Observation
   */
  prepareCriteria(
    criteria: Criteria | ResourceTypeCriteria,
    researchStudyIds: string[] = null
  ): Criteria | ResourceTypeCriteria | null {
    if (researchStudyIds?.length) {
      const preparedCriteria = this.prepareCriteria(criteria) || {
        condition: 'and',
        resourceType: PATIENT_RESOURCE_TYPE,
        rules: []
      };
      const ruleForResearchStudyIds = {
        field: {
          // The case when an element is not a search parameter is
          // specially taken into account in the function getQueryParam
          // of the service QueryParamsService.
          element: '_has:ResearchSubject:individual:study',
          value: researchStudyIds.join(',')
        }
      };
      const patientCriteria = this.findAndedWithOtherCriteriaFor(
        PATIENT_RESOURCE_TYPE,
        preparedCriteria
      );
      // Insert the criteria for the selected ResearchStudies into the existing
      // (ANDed with other) Patients criteria
      if (patientCriteria) {
        if (patientCriteria.condition === 'and') {
          patientCriteria.rules.push(ruleForResearchStudyIds);
        } else {
          // Split patient criteria to separate blocks
          delete patientCriteria.resourceType;
          ((patientCriteria as unknown) as Criteria).rules = patientCriteria.rules.map(
            (rule) => ({
              resourceType: PATIENT_RESOURCE_TYPE,
              condition: 'and',
              rules: [rule, ruleForResearchStudyIds]
            })
          );
        }
        return preparedCriteria;
      }

      // Otherwise add the root criteria for the selected ResearchStudies
      return {
        condition: 'and',
        rules: ([
          {
            condition: 'and',
            resourceType: PATIENT_RESOURCE_TYPE,
            rules: [ruleForResearchStudyIds]
          }
        ] as Array<Criteria | ResourceTypeCriteria>).concat(
          this.prepareCriteria(preparedCriteria) || []
        )
      } as Criteria;
    }

    if ('resourceType' in criteria) {
      // Remove empty resource type criteria so we don't have to consider them
      // in the search algorithm
      if (!criteria.rules.length) {
        return null;
      }

      let rules;

      // Combine code and value criteria for Observation
      const obsCodeCriterion = criteria.rules.find(
        (c) => c.field.element === CODETEXT
      );
      if (obsCodeCriterion) {
        const obsValueCriterion = criteria.rules.find(
          (c) => c.field.element === OBSERVATION_VALUE
        );
        if (obsValueCriterion) {
          rules = [
            ...criteria.rules.filter(
              (c) => c !== obsCodeCriterion && c !== obsValueCriterion
            ),
            {
              field: {
                ...obsCodeCriterion.field,
                value: obsValueCriterion.field.value
              }
            }
          ];
        }
      }

      if (!rules) {
        rules = criteria.rules.concat();
      }

      // We need a copy of the object in order not to visualize our changes
      return {
        // if we have only one criterion with the OR operator, replace the
        // operator with AND
        condition: criteria.rules.length === 1 ? 'and' : criteria.condition,
        resourceType: criteria.resourceType,
        rules
      };
    } else {
      // Remove empty subgroups so we don't have to consider them in the search algorithm
      const rules = criteria.rules.reduce((result, rule) => {
        const preparedRule = this.prepareCriteria(rule);
        if (preparedRule) {
          result.push(preparedRule);
        }
        return result;
      }, []);
      if (rules.length === 0) {
        return null;
      } else {
        // We need a copy of the object in order not to visualize our changes
        return {
          ...criteria,
          rules
        };
      }
    }
  }

  /**
   * Extracts the Patient ID from a patient-related resource or from a Patient
   * resource.
   */
  getPatientIdFromResource(resource: Resource): string {
    return resource.resourceType === PATIENT_RESOURCE_TYPE
      ? resource.id
      : /^Patient\/(.*)/.test((resource as any).subject.reference) && RegExp.$1;
  }

  /**
   * Returns the criteria tree sorted at each level by the total amount of
   * patient-related resources that match these criteria and populates the total
   * property for each resource criteria and resource subgroup.
   * This helps to find the best way to select Patients and get rid of
   * unnecessary searches.
   */
  getAmountOfResources(criteria: Criteria): Observable<Criteria> {
    if ('total' in criteria) {
      return of(criteria);
    }

    return (criteria.rules.length
      ? forkJoin(
          criteria.rules.map((ruleset) => {
            if ('resourceType' in ruleset) {
              // If the resource criteria are combined by the OR operator, we split them
              // into separate ones. ANDed criteria will be sent in one request.
              const rulesets =
                ruleset.condition === 'or'
                  ? ruleset.rules.map((rule) => [rule])
                  : [ruleset.rules];
              return forkJoin(
                rulesets.map((rules) =>
                  this.requestAmountOfResources(ruleset.resourceType, rules)
                )
              ).pipe(
                map((totals) => ({
                  ...ruleset,
                  total: totals.reduce((total, totalN) => total + totalN, 0)
                }))
              );
            } else {
              return this.getAmountOfResources(ruleset);
            }
          })
        )
      : of([])
    ).pipe(
      map((rules) => {
        const sortedRules =
          criteria.condition === 'and'
            ? rules.sort((x, y) => {
                if (x.total === Infinity && y.total === Infinity) {
                  return 0;
                }
                return x.total - y.total;
              })
            : rules;

        return {
          condition: criteria.condition,
          rules: sortedRules,
          total:
            criteria.condition === 'and'
              ? sortedRules[0].total
              : sortedRules.reduce((total, rule) => total + rule.total, 0)
        };
      })
    );
  }

  /**
   * Returns true if the _has query can be used to retrieve Patient resources
   * based on the specified criteria for specified resource type.
   */
  canUseHas(
    resourceType: string,
    criteriaForResourceType: Array<Criterion>
  ): boolean {
    // We can use _has to select Patients if we only have one
    // criterion for the resource type:
    return (
      resourceType !== PATIENT_RESOURCE_TYPE &&
      resourceType !== RESEARCH_STUDY_RESOURCE_TYPE &&
      resourceType !== EVIDENCE_VARIABLE_RESOURCE_TYPE &&
      criteriaForResourceType.length === 1 &&
      // Currently don't use _has for EV since it doesn't work with search parameter 'obs-evidence-variable'
      criteriaForResourceType[0].field.element !== 'evidencevariable' &&
      this.queryParams
        .getQueryParam(resourceType, criteriaForResourceType[0].field)
        .lastIndexOf('&') === 0
    );
  }

  /**
   * Returns true if the specified criteria has only one resource type criteria
   * block with Patient criteria.
   */
  isOnlyOneBlockWithPatientCriteria(
    criteria: Criteria | ResourceTypeCriteria
  ): boolean {
    if ('resourceType' in criteria) {
      return criteria.resourceType === PATIENT_RESOURCE_TYPE;
    } else {
      const oneResourceCriteria =
        criteria.rules.length === 1 && 'resourceType' in criteria.rules[0]
          ? criteria.rules[0]
          : false;
      return (
        oneResourceCriteria &&
        (oneResourceCriteria.resourceType === PATIENT_RESOURCE_TYPE ||
          this.canUseHas(
            oneResourceCriteria.resourceType,
            oneResourceCriteria.rules
          ))
      );
    }
  }

  /**
   * Requests an count of patient-related resources that match the specified
   * array of criteria. For ResearchStudy, requests an count of ResearchStudies
   * that have ResearchSubjects and treats a nonzero result as Infinity (each
   * ResearchStudy can have many ResearchSubjects).
   * @param resourceType - resource type
   * @param rules - array of ANDed criteria
   */
  requestAmountOfResources(
    resourceType: string,
    rules: Criterion[]
  ): Observable<number> {
    const hasResearchSubjects = this.getHasResearchSubjectsParam();
    const useHas = this.canUseHas(resourceType, rules);
    const queryResourceType =
      resourceType === EVIDENCE_VARIABLE_RESOURCE_TYPE
        ? OBSERVATION_RESOURCE_TYPE
        : useHas
        ? PATIENT_RESOURCE_TYPE
        : resourceType;

    const query =
      '$fhir/' +
      queryResourceType +
      '?_total=accurate&_summary=count' +
      (resourceType === RESEARCH_STUDY_RESOURCE_TYPE
        ? hasResearchSubjects
        : '') +
      rules
        .map((criterion: Criterion) => {
          const urlParamString = this.queryParams.getQueryParam(
            resourceType,
            criterion.field
          );
          return useHas
            ? urlParamString.replace(/&/g, `&_has:${resourceType}:subject:`)
            : urlParamString;
        })
        .join('');

    return this.http.get<Bundle>(query).pipe(
      map((response) => {
        if (!response.hasOwnProperty('total')) {
          return Infinity;
        }

        if (resourceType === RESEARCH_STUDY_RESOURCE_TYPE) {
          return response.total ? Infinity : 0;
        }
        return response.total;
      })
    );
  }

  /**
   * Requests resources related to Patient (or Patient resources) by criteria.
   * @param resourceType - resource type
   * @param rules - array of ANDed criteria
   * @param pageSize - page size
   * @param maxPatientCount - maximum number of Patients to load
   */
  requestResources(
    resourceType: string,
    rules: Criterion[],
    pageSize: number,
    maxPatientCount: number
  ): Observable<Resource[]> {
    // Returns an empty Observable if the maximum number of patients has been reached
    if (this.patientCount >= maxPatientCount) {
      return EMPTY;
    }

    // For ResearchStudy criteria, we requests ResearchStudies and then
    // recursively requests Patients for those ResearchStudies:
    if (resourceType === RESEARCH_STUDY_RESOURCE_TYPE) {
      const nextResearchStudyPage$ = new Subject<void>();
      const hasResearchSubjects = this.getHasResearchSubjectsParam();

      return this.http
        .get<Bundle>(
          `$fhir/${resourceType}?_count=${pageSize}&_elements=id${hasResearchSubjects}` +
            rules.map((criterion: Criterion) =>
              this.queryParams.getQueryParam(resourceType, criterion.field)
            )
        )
        .pipe(
          // Modifying the Observable to load the following pages sequentially
          this.loadPagesSequentially(maxPatientCount, nextResearchStudyPage$),
          // Expand the BundleEntries array into separate resources
          concatMap((response) => {
            return from((response?.entry || []).map((i) => i.resource.id)).pipe(
              bufferCount(10),
              concatMap((ids) => {
                return this.requestResources(
                  PATIENT_RESOURCE_TYPE,
                  [
                    {
                      field: {
                        element: '_has:ResearchSubject:individual:study',
                        value: ids.join(',')
                      }
                    }
                  ],
                  pageSize,
                  maxPatientCount
                );
              }),
              finalize(() => {
                nextResearchStudyPage$.next();
              })
            );
          })
        );
    }

    const useHas = this.canUseHas(resourceType, rules);
    const queryResourceType =
      resourceType === EVIDENCE_VARIABLE_RESOURCE_TYPE
        ? OBSERVATION_RESOURCE_TYPE
        : useHas
        ? PATIENT_RESOURCE_TYPE
        : resourceType;
    // If the resource is not a Patient, we extract only the subject
    // element in order to further identify the Patient by it.
    const elements =
      queryResourceType !== PATIENT_RESOURCE_TYPE ? '&_elements=subject' : '';
    const query =
      `$fhir/${queryResourceType}?_count=${pageSize}${elements}` +
      rules
        .map((criterion: Criterion) => {
          const urlParamString = this.queryParams.getQueryParam(
            resourceType,
            criterion.field
          );
          return useHas
            ? urlParamString.replace(/&/g, `&_has:${resourceType}:subject:`)
            : urlParamString;
        })
        .join('');

    return this.http.get<Bundle>(query).pipe(
      // Modifying the Observable to load the following pages sequentially
      this.loadPagesSequentially(
        maxPatientCount,
        this.numberOfProcessingResources$.pipe(
          // Waiting for processing of already loaded resources
          filter(
            (numberOfProcessingResources) => numberOfProcessingResources === 0
          )
        )
      ),
      // Expand the BundleEntries array into separate resources
      map((response: Bundle) => {
        const resources = (response?.entry || []).map((i) => i.resource);
        // Update the number of resources in processing
        this.numberOfProcessingResources$.next(
          this.numberOfProcessingResources$.value + resources.length
        );
        return resources;
      })
    );
  }

  /**
   * Modifies the Observable to load the following pages sequentially
   * @param maxPatientCount - maximum number of Patients to load
   * @param readyForNextPage - the next page request will be executed after this
   *   Observable emits a value.
   */
  loadPagesSequentially(
    maxPatientCount: number,
    readyForNextPage: Observable<any>
  ): OperatorFunction<Bundle, Bundle> {
    return expand((response: Bundle) => {
      const nextPageUrl = getNextPageUrl(response);
      if (!nextPageUrl) {
        // Emit a complete notification if there is no next page
        return EMPTY;
      }
      // Do not load next page before processing current page
      return readyForNextPage.pipe(
        // Load each page once
        take(1),
        switchMap(() => {
          if (this.patientCount < maxPatientCount) {
            // Load the next page of resources
            return this.http.get<Bundle>(nextPageUrl);
          } else {
            // Emit a complete notification
            return EMPTY;
          }
        })
      );
    });
  }

  /**
   * Returns URL parameter for ResearchStudy query with all possible ResearchSubject
   * statuses used to filter ResearchStudies that does not have ResearchSubjects.
   */
  getHasResearchSubjectsParam(): string {
    const statuses = Object.keys(
      this.fhirBackend.getCurrentDefinitions().valueSetMapByPath[
        'ResearchSubject.status'
      ]
    ).join(',');
    return `&_has:ResearchSubject:study:status=${statuses}`;
  }

  /**
   * Returns optimal page size for requesting resources.
   */
  getPageSize(): number {
    // The value (maxRequestsPerBatch*maxActiveRequests*2) is the "optimal" page
    // size to get resources for filtering/mapping. This value should be so
    // minimal as not to load a lot of unnecessary data, but sufficient to allow
    // parallel loading of data to speed up the process.
    return (
      this.fhirBackend.maxRequestsPerBatch *
      this.fhirBackend.maxActiveRequests *
      2
    );
  }

  /**
   * Find criteria for a specified resource type that are ANDed with other criteria
   * @param resourceType - resource type
   * @param criteria - all criteria
   */
  findAndedWithOtherCriteriaFor(
    resourceType: string,
    criteria: Criteria | ResourceTypeCriteria
  ): ResourceTypeCriteria {
    let result = null;
    if ('resourceType' in criteria) {
      if (criteria.resourceType === resourceType) {
        result = criteria;
      }
    } else if (criteria.condition === 'and') {
      const length = criteria.rules.length;
      for (let i = 0; i < length && !result; ++i) {
        result = this.findAndedWithOtherCriteriaFor(
          resourceType,
          criteria.rules[i]
        );
      }
    }
    return result;
  }
}
