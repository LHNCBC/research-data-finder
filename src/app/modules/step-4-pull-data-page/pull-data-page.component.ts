import {
  AfterViewInit,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges
} from '@angular/core';
import { map, startWith } from 'rxjs/operators';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { Observable, Subscription } from 'rxjs';
import {
  ColumnDescriptionsService
} from '../../shared/column-descriptions/column-descriptions.service';
import { FormControl, UntypedFormControl, Validators } from '@angular/forms';
import {
  SearchParameterGroupComponent
} from '../search-parameter-group/search-parameter-group.component';
import {
  SelectedObservationCodes
} from '../../types/selected-observation-codes';
import { PullDataService } from '../../shared/pull-data/pull-data.service';
import {
  dispatchWindowResize,
  getPluralFormOfResourceType
} from '../../shared/utils';
import {
  ResourceTableParentComponent
} from '../resource-table-parent.component';
import { SearchParameterGroup } from '../../types/search-parameter-group';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  CohortService,
  MAX_PAGE_SIZE
} from '../../shared/cohort/cohort.service';
import { TableRow } from '../resource-table/resource-table.component';
import { saveAs } from 'file-saver';
// Use ECMAScript module distributions of csv-stringify package for our browser app.
// See https://csv.js.org/stringify/distributions/browser_esm/
import { stringify } from 'csv-stringify/browser/esm/sync';
import { TableVirtualScrollDataSource } from 'ng-table-virtual-scroll';
import { MatTooltip } from '@angular/material/tooltip';
import {
  AutocompleteParameterValue
} from '../../types/autocomplete-parameter-value';
import { Criteria } from '../../types/search-parameters';
import Observation = fhir.Observation;

/**
 * The main component for pulling Patient-related resources data
 */
@Component({
  selector: 'app-pull-data-page',
  templateUrl: './pull-data-page.component.html',
  styleUrls: [
    './pull-data-page.component.less',
    '../resource-table/resource-table.component.less'
  ]
})
export class PullDataPageComponent
  extends ResourceTableParentComponent
  implements OnChanges, AfterViewInit, OnDestroy {
  MAX_PAGE_SIZE = MAX_PAGE_SIZE;
  // Default observation codes for the "Pull data for the cohort" step
  @Input()
  cohortCriteria: Criteria;
  defaultCodes: {[resourceType: string]: SelectedObservationCodes | AutocompleteParameterValue};

  // Array of visible resource type names
  visibleResourceTypes: string[];
  // Array of not visible resource type names
  unselectedResourceTypes: string[];
  // Array of resource type names that has "code text" search parameter
  codeTextResourceTypes: string[] = [];
  // Subscription to the loading process
  loadSubscription: { [resourceType: string]: Subscription } = {};
  // Subscription to change cohort criteria
  changeCriteriaSubscription: Subscription;

  // This observable is used to avoid ExpressionChangedAfterItHasBeenCheckedError
  // when the active tab changes
  currentResourceType$: Observable<string>;

  // Form controls of 'per patient' input
  perPatientFormControls: { [resourceType: string]: UntypedFormControl } = {};
  // Number of recent Observations per Patient to load when no code is specified
  // in the Observation criteria or when loading EvidenceVariables.
  maxObservationToCheck: { [resourceType: string]: UntypedFormControl } = {};
  // Whether any Observation code is added to the Observation criteria
  isObsCodesSelected = false;
  // Form controls of SearchParameterGroupComponents
  parameterGroups: {
    [resourceType: string]: FormControl<SearchParameterGroup>;
  } = {};
  // Selected Observation codes
  pullDataObservationCodes: Map<string, string> = null;

  // Columns for the Variable-Patient table
  variablePatientTableColumns: string[] = [];
  // DataSource for the Variable-Patient table
  variablePatientTableDataSource = new TableVirtualScrollDataSource<TableRow>(
    []
  );
  // Whether the Observation table can be converted to Variable-Patient table.
  canConvertToVariablePatientTable = false;
  // Whether the Variable-Patient table is full screen.
  fullscreen = false;

  constructor(
    private fhirBackend: FhirBackendService,
    public columnDescriptions: ColumnDescriptionsService,
    public cohort: CohortService,
    public pullData: PullDataService,
    private liveAnnouncer: LiveAnnouncer
  ) {
    super();
    ['Observation', 'EvidenceVariable'].forEach((resourceType) => {
      this.maxObservationToCheck[resourceType] = new FormControl<number>(1000, [
        Validators.required,
        Validators.min(1),
        Validators.max(MAX_PAGE_SIZE),
        Validators.pattern(/^\d+$/)
      ]);
    });
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

        []
          .concat(this.visibleResourceTypes, this.unselectedResourceTypes)
          .forEach((resourceType) => {
            // Due to optimization, we cannot control the number of ResearchStudies
            // per Patient. Luckily it doesn't make much sense.
            if (
              resourceType !== 'ResearchStudy' &&
              resourceType !== 'Patient'
            ) {
              const defaultCount =
                resourceType === 'EvidenceVariable'
                ? 10
                : resourceType === 'Observation'
                  ? 1
                  : 1000;
              this.perPatientFormControls[
                resourceType
              ] = new UntypedFormControl(defaultCount, [
                Validators.required,
                Validators.min(1)
              ]);
            }
            this.parameterGroups[
              resourceType
            ] = new FormControl<SearchParameterGroup>({
              resourceType,
              parameters: []
            });
          });

        this.isObsCodesSelected = false;
        this.parameterGroups.Observation.valueChanges.subscribe((value) => {
          const isObsCodesSelected =
            value.parameters[0]?.selectedObservationCodes?.items.length > 0;
          if (isObsCodesSelected !== this.isObsCodesSelected) {
            this.liveAnnouncer.announce(
              isObsCodesSelected
                ? 'The input field for the maximum number of recent Observations per Patient to check has disappeared.'
                : 'A new input field for the maximum number of recent Observations per Patient to check has appeared above.'
            );
          }
          this.isObsCodesSelected = isObsCodesSelected;
        });
      });
    this.changeCriteriaSubscription = this.cohort.criteria$.subscribe(() => this.cancelAllLoads());
  }

  /**
   * Cancel all loading processes.
   */
  cancelAllLoads(): void {
    Object.keys(this.loadSubscription).forEach(resourceType => this.cancelLoadOf(resourceType));
  }

  /**
   * Cancel download for the specified resource.
   * @param resourceType - resource type
   */
  cancelLoadOf(resourceType: string): void {
    this.loadSubscription[resourceType]?.unsubscribe();
    delete this.loadSubscription[resourceType];
  }

  /**
   * Returns plural form of resource type name.
   */
  getPluralFormOfResourceType = getPluralFormOfResourceType;

  ngAfterViewInit(): void {
    this.currentResourceType$ = this.tabGroup.selectedTabChange.pipe(
      startWith(this.getCurrentResourceType()),
      map(() => {
        dispatchWindowResize();
        return this.getCurrentResourceType();
      })
    );
  }

  ngOnDestroy(): void {
    this.cancelAllLoads();
    this.changeCriteriaSubscription.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.cohortCriteria && this.cohortCriteria) {
      this.defaultCodes = this.pullData.getCodesFromCriteria(this.cohortCriteria);
      this.updateAllCodeFiltersWithDefaults();
    }
  }

  /**
   * Updates all code filter fields with the default codes.
   * @private
   */
  private updateAllCodeFiltersWithDefaults(): void {
    if (this.defaultCodes) {
      this.isObsCodesSelected = this.defaultCodes.Observation?.items.length > 0;
      Object.keys(this.defaultCodes).forEach(resourceType => {
        if (this.parameterGroups[resourceType]) {
          this.updateCodeFilterWithDefaults(resourceType);
        }
      });
    }
  }

  /**
   * Updates the code filter field for the specified resource type with the
   * default codes.
   * @param resourceType - resource type.
   * @private
   */
  private updateCodeFilterWithDefaults(resourceType: string): void {
    const defaultCodes = this.defaultCodes?.[resourceType];
    if (resourceType === 'Observation') {
      this.isObsCodesSelected = defaultCodes?.items.length > 0;
    }
    if (defaultCodes) {
      if (resourceType === 'Observation') {
        this.parameterGroups['Observation'].setValue({
          resourceType: 'Observation',
          parameters: [
            {
              element: 'code text',
              selectedObservationCodes: this.defaultCodes.Observation as
                SelectedObservationCodes
            }
          ]
        });
      } else {
        // Selects the most appropriate search parameter element for the given resource type.
        // - Filters the search parameters for those whose `element` property matches the word "code".
        // - Sorts the filtered parameters to prioritize:
        //   1. Parameters where `element` is an array (descending by array length).
        //   2. If both are arrays, sorts by descending length of the `element` array.
        //   3. If both are not arrays, sorts by descending length of the `element` string.
        // - Picks the first (best) match, or defaults to `'code'` if none found.
        const element = this.fhirBackend.getCurrentDefinitions()
          .resources[resourceType]?.searchParameters.filter(p => /\bcode\b/.test(p.element))
          .sort((a, b) => {
            const aIsArray = Array.isArray(a.element) ? 1 : 0;
            const bIsArray = Array.isArray(b.element) ? 1 : 0;

            if (aIsArray !== bIsArray) {
              return bIsArray - aIsArray;
            } else if (aIsArray === 1) {
              return b.element.length - a.element.length;
            } else {
              return b.length - a.length;
            }
          })[0]?.element || 'code';
        this.parameterGroups[resourceType].setValue({
          resourceType,
          parameters: [
            {
              element,
              value: this.defaultCodes[resourceType]
            }
          ]
        });
      }
    }
  }


  /**
   * Whether to show code selection after Load button.
   */
  showCodeSelection(resourceType: string): boolean {
    // TODO: waiting feedback from Clem whether we will show code selection for all
    // resource types with a "code text" search parameter.
    return resourceType === 'Observation' || this.defaultCodes && Object.hasOwnProperty.call(this.defaultCodes, resourceType);
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
    this.updateCodeFilterWithDefaults(resourceType);
  }

  /**
   * Returns text for the remove tab button.
   */
  getRemoveTabButtonText(resourceType: string): string {
    return `Remove ${getPluralFormOfResourceType(resourceType)} tab`;
  }

  /**
   * Removes tab for specified resource type.
   */
  removeTab(resourceType: string): void {
    this.cancelLoadOf(resourceType);
    this.pullData.resetResourceData(resourceType);
    this.unselectedResourceTypes.push(resourceType);
    this.unselectedResourceTypes.sort();
    const removeIndex = this.visibleResourceTypes.indexOf(resourceType);
    if (removeIndex && removeIndex === this.tabGroup.selectedIndex) {
      this.tabGroup.selectedIndex--;
    }
    this.visibleResourceTypes.splice(removeIndex, 1);
  }

  /**
   * Opens a dialog for configuring resource table columns.
   */
  configureColumns(): void {
    const resourceType = this.getCurrentResourceType();
    this.columnDescriptions.openColumnsDialog(
      resourceType,
      resourceType === 'EvidenceVariable' && this.showOnlyUniqueEV
      ? 'pull-data-EV'
      : 'pull-data'
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
    this.cancelLoadOf(resourceType);

    if (resourceType === 'Observation') {
      // If in Variable-Patient table mode, reset to normal Observation table mode.
      this._isVariablePatientTable = false;
      // Clear Variable-Patient table dataSource which was built from the previous
      // Observation table data.
      this.variablePatientTableDataSource.data.length = 0;
      // Only allow converting to Variable-Patient table if Observation data is
      // loaded with 1 code per patient per test.
      this.canConvertToVariablePatientTable =
        this.perPatientFormControls[resourceType]?.value === 1;

      const selectedObservationCodes = parameterGroup.getSearchParamValues()[0]
        .selectedObservationCodes;
      this.pullDataObservationCodes = new Map();
      selectedObservationCodes.coding?.forEach((c, i) => {
        this.pullDataObservationCodes.set(
          c.code,
          selectedObservationCodes.items[i]
        );
      });
    }

    const conditions = parameterGroup.getConditions();
    this.loadSubscription[resourceType] = this.pullData
      .loadResources(
        resourceType,
        this.perPatientFormControls[resourceType]?.value || 1000,
        Array.isArray(conditions) ? conditions.map(c => c.criteria) : conditions.criteria,
        this.maxObservationToCheck[resourceType]?.value
      )
      .subscribe();
  }

  isMaxObservationToCheckVisible(resourceType: string): boolean {
    return this.maxObservationToCheck[resourceType] && ((resourceType === 'Observation' && !this.isObsCodesSelected) || (resourceType === 'EvidenceVariable'));
  }

  /**
   * Check if the input controls on the tab for the specified resource type have
   * valid values.
   * @param resourceType - resource type
   */
  isValidTab(resourceType: string): boolean {
    return (
      (!this.perPatientFormControls[resourceType] || this.perPatientFormControls[resourceType].valid)
      && (!this.isMaxObservationToCheckVisible(resourceType) || this.maxObservationToCheck[resourceType].valid)
    );
  }

  /**
   * Get an object to be saved into sessionStorage before RAS re-login.
   */
  getReloginStatus(): any[] {
    return this.visibleResourceTypes.map((r) => {
      const tabInfo = {
        resourceType: r,
        perPatientFormControls: this.perPatientFormControls[r]?.value,
        parameterGroups: this.parameterGroups[r].value
      };
      if (r === 'Observation' || r === 'EvidenceVariable') {
        tabInfo['maxObservationToCheck'] = this.maxObservationToCheck[r].value;
      }
      return tabInfo;
    });
  }

  /**
   * Restore opened resource tabs and related form controls
   * @param restoreStatus an object constructed from getReloginStatus() method.
   */
  restoreLoginStatus(restoreStatus: any[]): void {
    let hasObservationTab = false;
    restoreStatus.forEach((x) => {
      if (x.resourceType === 'Observation' || x.resourceType === 'EvidenceVariable') {
        hasObservationTab = true;
        this.maxObservationToCheck[x.resourceType].setValue(x.maxObservationToCheck || 1000);
      } else {
        this.addTab(x.resourceType);
      }
      this.perPatientFormControls[x.resourceType]?.setValue(
        x.perPatientFormControls
      );
      this.parameterGroups[x.resourceType].setValue(x.parameterGroups);
    });
    if (!hasObservationTab) {
      this.removeTab('Observation');
    }
  }

  /**
   * Property to indicate whether to show the Variable-Patient table or the normal
   * resource table.
   */
  private _isVariablePatientTable = false;
  get isVariablePatientTable(): boolean {
    return this._isVariablePatientTable;
  }
  set isVariablePatientTable(value: boolean) {
    if (value && !this.variablePatientTableDataSource.data.length) {
      this.buildVariablePatientTableData();
    }
    this._isVariablePatientTable = value;
  }

  /**
   * Show only unique EvidenceVariables.
   */
  public showOnlyUniqueEV = false;

  /**
   * Construct the dataSource for the Variable-Patient table from the Observation table.
   * It is called if user switch to Variable-Patient table after the Observation table is
   * fully loaded. It uses cell data from the Observation table, so they don't need to be
   * calculated again.
   */
  buildVariablePatientTableData(): void {
    const observationResourcetableComponent = this.tables.find(
      (rt) => rt.resourceType === 'Observation'
    );
    const observationTableData =
      observationResourcetableComponent.dataSource.data;
    this.variablePatientTableColumns = ['Patient'].concat(
      Array.from(
        new Set(
          // "Variable Name" (codeText) column values from the Observation table are used
          // as column headers in the Variable-Patient table.
          observationTableData.map((tableRow) => tableRow.cells['codeText'])
        )
      )
    );
    // A map of patient to variable data required for the Variable-Patient table.
    const variablePatientMap = new Map();
    observationTableData.forEach((tableRow) => {
      if (!variablePatientMap.has(tableRow.cells['subject'])) {
        variablePatientMap.set(tableRow.cells['subject'], {
          cells: {
            // Data for Patient column in Variable-Patient table
            Patient: tableRow.cells['subject']
          },
          valueQuantityData: {}
        } as TableRow);
      }
      const patientRow = variablePatientMap.get(tableRow.cells['subject']);
      patientRow.cells[tableRow.cells['codeText']] = tableRow.cells['value[x]'];
      // valueQuantityData holds data for downloading the Variable-Patient table with
      // value and unit as separate columns. It is not used for displaying the table.
      // We could instead do another loop to set this data when user clicks download.
      // I'm setting it here to save another loop, since downloading seems the common
      // use case for the Variable-Patient table.
      patientRow.valueQuantityData[
        tableRow.cells['codeText']
      ] = (tableRow.resource as Observation).valueQuantity;
    });
    this.variablePatientTableDataSource.data = Array.from(
      variablePatientMap,
      (x) => x[1]
    );
  }

  /**
   * Initiates downloading of resourceTable data in CSV format.
   * Overrides parent method in ResourceTableParentComponent.
   */
  downloadCsv(): void {
    if (
      this.isVariablePatientTable &&
      this.getCurrentResourceType() === 'Observation'
    ) {
      const valueQuantityColumns = [];
      const valueQuantityData = this.variablePatientTableDataSource.data[0]
        .valueQuantityData;
      const header = this.variablePatientTableColumns
        .map((c) => {
          if (c === 'Patient') {
            return c;
          } else if (valueQuantityData[c]) {
            // It is a column of type "ValueQuantity".
            valueQuantityColumns.push(c);
            // Separate each column into value & unit columns in export
            return [`${c} Value`, `${c} Unit`];
          } else {
            // For a non-ValueQuantity column, don't add an extra "Unit" column.
            return c;
          }
        })
        .flat();
      const rows = this.variablePatientTableDataSource.data.map((row) =>
        this.variablePatientTableColumns
          .map((column) => {
            if (column === 'Patient') {
              return row.cells[column];
            } else if (valueQuantityColumns.includes(column)) {
              // Return "Value" and "Unit" columns for a ValueQuantity column.
              const valueQuantity = row.valueQuantityData[column];
              return valueQuantity
                ? [valueQuantity.value ?? '', valueQuantity.unit ?? '']
                : [row.cells[column], ''];
            } else {
              // Return single column for a non-ValueQuantity column, consistent with the header.
              return row.cells[column];
            }
          })
          .flat()
      );
      saveAs(
        new Blob([stringify([header].concat(rows))], {
          type: 'text/plain;charset=utf-8',
          endings: 'native'
        }),
        'variable-patient.csv'
      );
    } else {
      super.downloadCsv();
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen(): void {
    this.fullscreen = !this.fullscreen;
  }

  /**
   * Toggles tooltip.
   * @param event the click event
   * @param tooltip MatTooltip object
   */
  onInfoIconClick(event: any, tooltip: MatTooltip): void {
    tooltip.toggle();
    this.liveAnnouncer.announce(tooltip.message);
  }
}
