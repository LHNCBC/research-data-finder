import {
  AfterViewInit,
  Component,
  Input,
  OnChanges,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { map, startWith, take } from 'rxjs/operators';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { MatTabGroup } from '@angular/material/tabs';
import { Observable } from 'rxjs';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { FormControl, Validators } from '@angular/forms';
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { saveAs } from 'file-saver';
import { SearchParameterGroupComponent } from '../search-parameter-group/search-parameter-group.component';
import { SelectedObservationCodes } from '../../types/selected-observation-codes';
import { PullDataService } from '../../shared/pull-data/pull-data.service';
import { getPluralFormOfResourceType } from '../../shared/utils';

/**
 * The main component for pulling Patient-related resources data
 */
@Component({
  selector: 'app-pull-data-page',
  templateUrl: './pull-data-page.component.html',
  styleUrls: ['./pull-data-page.component.less']
})
export class PullDataPageComponent implements OnChanges, AfterViewInit {
  @ViewChild(MatTabGroup) tabGroup: MatTabGroup;
  @ViewChildren(ResourceTableComponent)
  resourceTables: QueryList<ResourceTableComponent>;
  @ViewChildren(SearchParameterGroupComponent)
  parameterGroups: QueryList<SearchParameterGroupComponent>;
  // Default observation codes for the "Pull data for the cohort" step
  @Input() defaultObservationCodes: SelectedObservationCodes;

  // Array of visible resource type names
  visibleResourceTypes: string[];
  // Array of not visible resource type names
  unselectedResourceTypes: string[];
  // Array of resource type names that has "code text" search parameter
  codeTextResourceTypes: string[] = [];

  // This observable is used to avoid ExpressionChangedAfterItHasBeenCheckedError
  // when the active tab changes
  currentResourceType$: Observable<string>;

  // Form controls of 'per patient' input
  perPatientFormControls: { [resourceType: string]: FormControl } = {};

  constructor(
    private fhirBackend: FhirBackendService,
    public columnDescriptions: ColumnDescriptionsService,
    public pullData: PullDataService
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
          const defaultCount = r === 'EvidenceVariable' ? 1 : 1000;
          // Due to optimization, we cannot control the number of ResearchStudies
          // per Patient. Luckily it doesn't make much sense.
          if (r !== 'ResearchStudy' && r !== 'Patient') {
            this.perPatientFormControls[r] = new FormControl(defaultCount, [
              Validators.required,
              Validators.min(1)
            ]);
          }
        });
      });
  }

  /**
   * Returns plural form of resource type name.
   */
  getPluralFormOfResourceType = getPluralFormOfResourceType;

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
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.defaultObservationCodes) {
      this.updateObservationCodesWithDefaults();
    }
  }

  /**
   * Sets the default observation codes to the appropriate autocomplete field.
   * @private
   */
  private updateObservationCodesWithDefaults(): void {
    if (this.defaultObservationCodes) {
      const observationParameterGroup = this.parameterGroups.find(
        (parameterGroup) => parameterGroup.inputResourceType === 'Observation'
      );
      if (observationParameterGroup) {
        observationParameterGroup.parameterList.controls[0].setValue({
          element: 'code text',
          selectedObservationCodes: this.defaultObservationCodes
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
    if (resourceType === 'Observation') {
      // Update the default observation codes for the newly created Observation tab.
      this.parameterGroups.changes.pipe(take(1)).subscribe(() => {
        setTimeout(() => this.updateObservationCodesWithDefaults());
      });
    }
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
    this.pullData.loadResources(
      resourceType,
      this.perPatientFormControls[resourceType]?.value || 1000,
      parameterGroup.getConditions().criteria
    );
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
      getPluralFormOfResourceType(currentResourceType).toLowerCase() + '.csv'
    );
  }
}
