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
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CohortService, MAX_PAGE_SIZE } from '../../shared/cohort/cohort.service';
import { Criteria, ResourceTypeCriteria } from '../../types/search-parameters';
import { HttpContext } from '@angular/common/http';
import { BrowseRecordsPageComponent } from '../browse-records-page/browse-records-page.component';
import { MatTabGroup } from '@angular/material/tabs';
import {
  SearchParametersComponent
} from '../search-parameters/search-parameters.component';
import {ErrorStateMatcher} from "@angular/material/core";
import {ErrorManager} from "../../shared/error-manager/error-manager.service";

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
  ],
  standalone: false
})
export class SelectRecordsPageComponent
  extends BrowseRecordsPageComponent
  implements AfterViewInit, OnDestroy {
  MAX_PAGE_SIZE = MAX_PAGE_SIZE;
  @ViewChild('additionalCriteria')
  additionalCriteria: SearchParametersComponent;
  @ViewChild('tabGroup') tabGroup: MatTabGroup;
  maxPatientsNumber = new UntypedFormControl(
    this.cohort.maxPatientCount,
    [Validators.required, Validators.max(MAX_PAGE_SIZE), Validators.pattern(/^\d+$/)]
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
      'Added selected variables to the cart area above.'
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
    const resourceTable =
      // we can use resourceType="Observation" for the variable table
      resourceType === 'Variable'
        ? this.variableTable
        : this.tables?.find((table) => table.resourceType === resourceType);
    resourceTable?.selectedResources.clear();
  }

  /**
   * Loads variable records.
   * @param pageNumber - page number to load
   */
  loadVariables(pageNumber = 0): void {
    const studiesInCart = this.cart.getListItems('ResearchStudy');
    this.selectRecords.loadVariables(
      [].concat(
        ...(studiesInCart?.length
          ? studiesInCart
          : this.selectRecords.currentState['ResearchStudy'].resources || [])
      ),
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
   * Returns selected records of the specified resource type.
   * @param resourceType - resource type
   */
  getSelectedRecords(resourceType: string): Resource[] {
    return [].concat(...(this.cart.getListItems(resourceType) || []));
  }

  /**
   * Loads the first page of the specified resource type.
   * @param resourceType - resource type.
   */
  loadFirstPage(resourceType: string): void {
    if (resourceType === 'Variable') {
      this.loadVariables();
    } else if (resourceType === 'Observation') {
      this.selectRecords.loadFirstPageOfVariablesFromObservations(
        this.getSelectedRecords('ResearchStudy'),
        ...this.getParametersToLoadPageOfVariables()
      );
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
    if (this.maxPatientsNumber.invalid) {
      this.liveAnnouncer.announce('Maximum number of patients field is not valid.');
    }
    this.errorManager.showErrors();
    // Go to the last tab, which is "Additional Criteria", if it has validation errors.
    if (this.additionalCriteria.hasErrors()) {
      this.tabGroup.selectedIndex = this.visibleResourceTypes.length;
    }
    setTimeout(() => {
      document.querySelector('.mat-form-field-invalid')?.scrollIntoView();
    });
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
   * Gets the cohort criteria from controls.
   */
  getCriteriaFromControls(): Criteria {
    const additionalCriteria = this.additionalCriteria.queryCtrl.value;

    const variableCriteria: Criteria = this.getVariableCriteria();

    return additionalCriteria.rules.length
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
  }

  /**
   * Searches for a list of Patient resources that match the records in the cart.
   */
  searchForPatients(): void {
    const criteria: Criteria = this.getCriteriaFromControls();
    this.cohort.searchForPatients(
      criteria,
      this.maxPatientsNumber.value,
      [].concat(...(this.cart.getListItems('ResearchStudy') || []))
        .map((r) => r.id)
    );
  }

  /**
   * Sets all selected records and lookups.
   * This is called when loading cohort or after RAS re-login in cart-based approach.
   */
  setCartCriteria(
    cartCriteria: any,
    additionalCriteria: any
  ): void {
    // Select the 'Variables' tab so the variable constraint controls is visible.
    // Otherwise, the Prefetch autocomplete of a 'unit' control in 'Variables' cart cannot be setup.
    this.tabGroup.selectedIndex = 1;
    setTimeout(() => {
      this.cart.setCartCriteria(cartCriteria);
      // Select and restore 'additional criteria' tab.
      this.tabGroup.selectedIndex = 2;
      setTimeout(() => {
        this.additionalCriteria.queryCtrl.setValue(additionalCriteria);
        setTimeout(() => {
          // Switch back to 'Studies' tab.
          this.tabGroup.selectedIndex = 0;
          this.cohort.setCriteria(this.getCriteriaFromControls());
        }, 50);
      });
    });
  }
}
