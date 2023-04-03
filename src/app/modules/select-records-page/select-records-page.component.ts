import { AfterViewInit, Component, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormControl, Validators } from '@angular/forms';
import {
  CACHE_NAME,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import Resource = fhir.Resource;
import { SelectRecordsService } from '../../shared/select-records/select-records.service';
import { CartService, ListItem } from '../../shared/cart/cart.service';
import { getPluralFormOfRecordName, getRecordName } from '../../shared/utils';
import { ErrorManager } from '../../shared/error-manager/error-manager.service';
import { ErrorStateMatcher } from '@angular/material/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CohortService } from '../../shared/cohort/cohort.service';
import { Criteria, ResourceTypeCriteria } from '../../types/search-parameters';
import { SearchParameterGroupComponent } from '../search-parameter-group/search-parameter-group.component';
import { HttpContext } from '@angular/common/http';
import { BrowseRecordsPageComponent } from '../browse-records-page/browse-records-page.component';

/**
 * Component for searching, selecting, and adding records to the cart.
 */
@Component({
  selector: 'app-select-records-page',
  templateUrl: './select-records-page.component.html',
  styleUrls: ['./select-records-page.component.less'],
  providers: [
    ErrorManager,
    {
      provide: ErrorStateMatcher,
      useExisting: ErrorManager
    }
  ]
})
export class SelectRecordsPageComponent
  extends BrowseRecordsPageComponent
  implements AfterViewInit, OnDestroy {
  @ViewChild('additionalCriteria')
  additionalCriteria: SearchParameterGroupComponent;
  maxPatientsNumber = new UntypedFormControl(
    this.cohort.maxPatientCount,
    Validators.required
  );
  showOnlyStudiesWithSubjects = true;

  constructor(
    public fhirBackend: FhirBackendService,
    public columnDescriptions: ColumnDescriptionsService,
    public selectRecords: SelectRecordsService,
    private liveAnnouncer: LiveAnnouncer,
    private errorManager: ErrorManager,
    public cohort: CohortService,
    public cart: CartService
  ) {
    super(fhirBackend, columnDescriptions, selectRecords);
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
  }

  ngAfterViewInit(): void {
    super.ngAfterViewInit();
  }

  /**
   * Adds records of the specified resource type to the card.
   * @param resourceType - resource type
   * @param resources - records to add
   */
  addRecordsToCart(resourceType, resources: Resource[]): void {
    this.cart.addRecords(resourceType, resources);
    this.clearSelectedRecords(resourceType);
    if (resourceType === 'ResearchStudy') {
      this.selectRecords.resetState('Variable');
      this.selectRecords.resetState('Observation');
      this.clearSelectedRecords('Variable');
    }
    this.liveAnnouncer.announce(
      'Added selected variables to the cart area below.'
    );
  }

  /**
   * Removes record from the cart.
   * @param resourceType - resource type
   * @param listItem - list item, this can be a record or a group (array)
   *   of records.
   */
  removeRecordFromCart(resourceType: string, listItem: ListItem): void {
    this.cart.removeRecords(resourceType, [listItem]);
    if (resourceType === 'ResearchStudy') {
      this.selectRecords.resetState('Variable');
      this.selectRecords.resetState('Observation');
      this.clearSelectedRecords('Variable');
    }
    this.liveAnnouncer.announce(
      `Removed ${
        this.cart.isGroup(listItem)
          ? 'group of ' + getPluralFormOfRecordName(resourceType)
          : getRecordName(resourceType)
      } from the cart.`
    );
  }

  /**
   * Clears the selected records of the specified resource type.
   * @param resourceType - resource type
   */
  clearSelectedRecords(resourceType: string): void {
    const resourceTable = this.tables?.find(
      (table) => table.resourceType === resourceType
    );
    resourceTable?.selectedResources.clear();
  }

  /**
   * Loads variable records.
   * @param pageNumber - page number to load
   */
  loadVariables(pageNumber = 0): void {
    this.selectRecords.loadVariables(
      [].concat(...(this.cart.getListItems('ResearchStudy') || [])),
      this.recTypeLoinc
        ? {
            rec_type: 'loinc'
          }
        : this.hasLoinc
        ? {
            rec_type: 'dbgv',
            has_loinc: this.hasLoinc
          }
        : {
            rec_type: 'dbgv'
          },
      this.variableTable?.filtersForm.value || {},
      this.sort['Variable'],
      pageNumber
    );
  }

  /**
   * Loads Observation records.
   * @param reset - whether to reset already loaded data
   */
  loadObservations(reset = true): void {
    this.selectRecords.loadObservations(
      [].concat(...(this.cart.getListItems('ResearchStudy') || [])),
      {},
      this.variableTable?.filtersForm.value || {},
      this.sort['Observation'],
      reset
    );
  }

  /**
   * Loads the first page of the specified resource type.
   * @param resourceType - resource type.
   */
  loadFirstPage(resourceType: string): void {
    if (resourceType === 'Variable') {
      this.loadVariables();
    } else if (resourceType === 'Observation') {
      this.loadObservations();
    } else if (resourceType === 'ResearchStudy') {
      const cacheName = this.showOnlyStudiesWithSubjects ? '' : 'studies';
      const hasStatuses = this.showOnlyStudiesWithSubjects
        ? '&_has:ResearchSubject:study:status=' +
          Object.keys(
            this.fhirBackend.getCurrentDefinitions().valueSetMapByPath[
              'ResearchSubject.status'
            ]
          ).join(',')
        : '';
      this.selectRecords.loadFirstPage(
        resourceType,
        `$fhir/${resourceType}?_count=3000${hasStatuses}`,
        {
          context: new HttpContext().set(CACHE_NAME, cacheName)
        }
      );
    } else {
      this.selectRecords.loadFirstPage(
        resourceType,
        `$fhir/${resourceType}?_count=100`,
        {}
      );
    }
  }

  /**
   * Checks for errors
   */
  hasErrors(): boolean {
    return this.errorManager.errors !== null;
  }

  /**
   * Shows errors for existing formControls
   */
  showErrors(): void {
    this.errorManager.showErrors();
  }

  /**
   * Converts a variable list item or a group of list items from the cart into criteria
   * for searching patients.
   * @param item - a list item of the cart of variables.
   */
  convertListItemToCriteria(
    item: any /*ListItem*/
  ): Criteria | ResourceTypeCriteria {
    if (Array.isArray(item)) {
      return {
        condition: 'or',
        rules: item.map((i) => this.convertListItemToCriteria(i))
      };
    } else {
      return {
        condition: 'and',
        rules: [
          {
            field: {
              element: 'code text',
              value: '',
              selectedObservationCodes: {
                coding:
                  item.resourceType === 'Observation'
                    ? item.code.coding
                    : [
                        {
                          code: item.id,
                          system: ''
                        }
                      ],
                datatype: this.cart.getVariableType(item),
                // TODO: get from loaded variable?
                items: [
                  item.display_name ||
                    item.code.text ||
                    item.code.coding[0].display
                ]
              }
            }
          },
          ...(this.cart.variableData[item.id]?.value &&
          this.cart.variableData[item.id].value.testValue !== null &&
          this.cart.variableData[item.id].value.testValue !== ''
            ? [
                {
                  field: {
                    element: 'observation value',
                    value: this.cart.variableData[item.id].value
                  }
                }
              ]
            : [])
        ],
        resourceType: 'Observation'
      };
    }
  }

  /**
   * Returns criteria for variables.
   */
  getVariableCriteria(): Criteria {
    const resourceType =
      this.visibleResourceTypes.indexOf('Observation') === -1
        ? 'Variable'
        : 'Observation';
    return {
      condition: this.cart.logicalOperator[resourceType],
      rules:
        this.cart
          .getListItems(resourceType)
          ?.map((i) => this.convertListItemToCriteria(i)) || []
    };
  }

  /**
   * Searches for a list of Patient resources that match the records in the cart.
   */
  searchForPatients(): void {
    const additionalCriteria: ResourceTypeCriteria = {
      condition: 'and',
      resourceType: 'Patient',
      rules: this.additionalCriteria
        .getSearchParamValues()
        .map((v) => ({ field: v }))
    };

    const variableCriteria: Criteria = this.getVariableCriteria();

    const criteria: Criteria = additionalCriteria.rules.length
      ? variableCriteria.condition === 'and'
        ? {
            condition: 'and',
            rules: variableCriteria.rules.concat(additionalCriteria)
          }
        : {
            condition: 'and',
            rules: [additionalCriteria, variableCriteria]
          }
      : variableCriteria;

    this.cohort.searchForPatients(
      criteria,
      this.maxPatientsNumber.value,
      variableCriteria.rules.length
        ? null
        : []
            .concat(...(this.cart.getListItems('ResearchStudy') || []))
            .map((r) => r.id)
    );
  }
}
