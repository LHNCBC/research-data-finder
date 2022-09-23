import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import Resource = fhir.Resource;
import { HttpClient } from '@angular/common/http';
import Bundle = fhir.Bundle;
import { ObservationTestValue } from '../../modules/search-parameter/observation-test-value.component';

export type SelectedRecords = { [id: string]: Resource };

/**
 * Service for storing records in the cart.
 */
@Injectable({
  providedIn: 'root'
})
export class CartService {
  private selectedRecords: {
    [resourceType: string]: SelectedRecords;
  } = {};

  public logicalOperator: {
    [resourceType: string]: 'and' | 'or';
  } = {
    ResearchStudy: 'and',
    Variable: 'and'
  };

  public variableData: {
    [uid: string]: {
      datatype: string;
      value?: ObservationTestValue;
    };
  } = {};

  private selectionChanged: {
    [resourceType: string]: Subject<SelectedRecords>;
  } = {};

  constructor(private http: HttpClient) {}

  /**
   * Adds records of the specified resource type to the card.
   * @param resourceType - resource type
   * @param newRecords - records to add
   */
  addRecords(resourceType: string, newRecords: Resource[]): void {
    const selectedRecords = (this.selectedRecords[resourceType] =
      this.selectedRecords[resourceType] || {});

    newRecords.forEach((record) => {
      selectedRecords[this.getResourceId(record)] = record;
    });
    if (resourceType === 'ResearchStudy') {
      this.updateVariables();
    } else if (resourceType === 'Variable') {
      newRecords.forEach((record) => {
        if (!this.variableData[record.id]) {
          this.http
            .get<Bundle>(`$fhir/Observation?_count=1&combo-code=${record.id}`)
            .subscribe(
              (bundle) => {
                const observation = bundle.entry?.[0]?.resource;
                this.variableData[record.id] = { datatype: 'empty' };
                for (const prop in observation || {}) {
                  if (prop.startsWith('value')) {
                    const datatype = prop.substr(5);
                    this.variableData[record.id] = {
                      datatype
                    };

                    if (datatype === 'Quantity') {
                      const testValueUnit = observation[prop].unit;
                      if (testValueUnit) {
                        this.variableData[record.id].value = {
                          observationDataType: datatype,
                          testValuePrefix: '',
                          testValueModifier: '',
                          testValue: '',
                          testValueUnit
                        };
                      }
                    }
                    break;
                  }
                }
              },
              () => {
                this.variableData[record.id] = { datatype: 'error' };
              }
            );
        }
      });
    }
    this.getCartChangedSubject(resourceType).next(selectedRecords);
  }

  /**
   * Returns the value type of variable by unique ID.
   * @param uid - Unique id, either dbGaP variable id or LOINC number depending
   *   on rec_type.
   */
  getVariableType(uid: string): string {
    return this.variableData[uid]?.datatype;
  }

  /**
   * Removes records of the specified resource type from the card.
   * @param resourceType - resource type
   * @param resources - records to remove
   */
  removeRecords(resourceType: string, resources: Resource[]): void {
    const ids = this.selectedRecords[resourceType];
    resources.forEach((resource) => {
      delete ids[this.getResourceId(resource)];
    });
    if (resourceType === 'ResearchStudy') {
      this.updateVariables();
    }
    this.getCartChangedSubject(resourceType).next(ids);
  }

  /**
   * Updates Variables in the cart when removing ResearchStudies from the cart.
   */
  updateVariables(): void {
    const researchStudies = this.selectedRecords['ResearchStudy'];
    const variables = this.selectedRecords['Variable'];
    if (researchStudies && variables) {
      // TODO: IDs may not match. I don't know yet how to solve this problem.
      Object.values(variables).forEach((variable) => {
        if (!researchStudies[(variable as any).study_id]) {
          delete variables[this.getResourceId(variable)];
        }
      });
    }
  }

  /**
   * Returns resource ID.
   * @param resource - resource
   */
  getResourceId(resource: Resource): string {
    return (resource as any).identifier?.[0].value || resource.id;
  }

  /**
   * Checks whether a record of the specified resource type exists in the card.
   * @param resourceType - resource type
   * @param resource - resource
   */
  hasRecord(resourceType: string, resource: Resource): boolean {
    return (
      this.selectedRecords[resourceType]?.[this.getResourceId(resource)] !==
      undefined
    );
  }

  /**
   * Returns records of the specified resource type from the cart.
   * @param resourceType - resource type
   */
  getRecords(resourceType: string): Resource[] {
    return Object.values(this.selectedRecords[resourceType] || {});
  }

  /**
   * Returns an observable that emits the current SelectedRecords of
   * the specified resource type when the cart for that resource type changes.
   * @param resourceType - resource type
   */
  getCartChanged(resourceType: string): Observable<SelectedRecords> {
    return this.getCartChangedSubject(resourceType).asObservable();
  }

  /**
   * Returns a subject for emitting the current SelectedRecords of the specified
   * resource type when the cart for that resource type changes.
   * @param resourceType - resource type
   */
  private getCartChangedSubject(
    resourceType: string
  ): Subject<SelectedRecords> {
    if (!this.selectionChanged[resourceType]) {
      this.selectionChanged[resourceType] = new Subject<SelectedRecords>();
    }
    return this.selectionChanged[resourceType];
  }

  /**
   * Resets all selected records.
   */
  reset(): void {
    this.selectedRecords = {};
  }
}
