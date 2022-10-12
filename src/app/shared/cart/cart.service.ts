import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import Resource = fhir.Resource;
import { HttpClient } from '@angular/common/http';
import Bundle = fhir.Bundle;
import { ObservationTestValue } from '../../modules/search-parameter/observation-test-value.component';
import fhirpath from 'fhirpath';
import { sortBy } from 'lodash-es';
import { AutocompleteOption } from '../../modules/autocomplete/autocomplete.component';

// List item, this can be a record or a group (array) of records
export type ListItem = Resource | Resource[];

type ListData = {
  // List of records in the cart, if the list item is an array, it is a group
  // of records.
  list: ListItem[];
  // Mapping a record ID to a record used for quick access record data.
  byId: Map<string, Resource>;
};

/**
 * Service for storing records in the cart.
 */
@Injectable({
  providedIn: 'root'
})
export class CartService {
  private itemsByResourceType: {
    [resourceType: string]: ListData;
  } = {};

  public logicalOperator: {
    [resourceType: string]: 'and' | 'or';
  } = {};

  public variableData: {
    [uid: string]: {
      datatype: string;
      value?: ObservationTestValue;
    };
  } = {};

  public variableUnits: {
    [uid: string]: AutocompleteOption[];
  } = {};

  private selectionChanged: {
    [resourceType: string]: Subject<ListData>;
  } = {};

  constructor(private http: HttpClient) {}

  /**
   * Adds records of the specified resource type to the card.
   * @param resourceType - resource type
   * @param newRecords - records to add
   */
  addRecords(resourceType: string, newRecords: Resource[]): void {
    const items = (this.itemsByResourceType[resourceType] = this
      .itemsByResourceType[resourceType] || {
      list: [],
      byId: new Map<string, Resource>()
    });

    newRecords = newRecords.filter((record) => {
      const recordId = this.getResourceId(record);
      const isNewRecord = !items.byId.has(recordId);
      if (isNewRecord) {
        items.byId.set(recordId, record);
      }
      return isNewRecord;
    });

    if (newRecords.length) {
      // Update list
      items.list = items.list.concat(newRecords);

      if (resourceType === 'ResearchStudy') {
        this.updateVariables();
      } else if (resourceType === 'Variable') {
        newRecords.forEach((record) => {
          const id = this.getResourceId(record);
          if (!this.variableData[id]) {
            this.http
              .get<Bundle>(`$fhir/Observation?_count=1&combo-code=${id}`)
              .subscribe(
                (bundle) => {
                  const observation = bundle.entry?.[0]?.resource;
                  this.variableData[id] = { datatype: 'empty' };
                  for (const prop in observation || {}) {
                    if (prop.startsWith('value')) {
                      const datatype = prop.substr(5);
                      this.variableData[id] = {
                        datatype
                      };

                      if (datatype === 'Quantity') {
                        const unitCode = observation[prop].code || '';
                        this.variableUnits[id] = [];

                        if (unitCode) {
                          let isFromList = false;
                          // TODO: ucumUtils is not added to index.d.ts of fhirpath.js
                          const unitList = (fhirpath as any).ucumUtils
                            .commensurablesList(unitCode)[0]
                            .map((i) => {
                              if (i.csCode_ === unitCode) {
                                isFromList = true;
                              }
                              return { name: i.name_, value: i.csCode_ };
                            });
                          this.variableUnits[id] = isFromList
                            ? sortBy(unitList, 'name')
                            : [];
                          this.variableData[id].value = {
                            observationDataType: datatype,
                            testValuePrefix: '',
                            testValueModifier: '',
                            testValue: '',
                            testValueUnit: unitCode
                          };
                        }
                      }
                      break;
                    }
                  }
                },
                () => {
                  this.variableData[id] = { datatype: 'error' };
                }
              );
          }
        });
      }
      this.getCartChangedSubject(resourceType).next(items);
    }
  }

  /**
   * Returns the value type of variable by unique ID.
   * @param listItem - list item, this can be a record or a group (array)
   *   of records.
   */
  getVariableType(listItem: ListItem): string {
    const uid = Array.isArray(listItem) ? listItem[0].id : listItem.id;
    return this.variableData[uid]?.datatype;
  }

  /**
   * Removes list items of the specified resource type from the card.
   * @param resourceType - resource type
   * @param listItems - list items, each of each can be a record or a group (array)
   *   of records.
   */
  removeRecords(resourceType: string, listItems: ListItem[]): void {
    const recordsToRemove = new Set<ListItem>(listItems);
    const items = this.itemsByResourceType[resourceType];

    // Update mapping by record ID
    new Set<string>(
      [].concat(...listItems).map((record) => this.getResourceId(record))
    ).forEach((id) => {
      items.byId.delete(id);
    });

    // Update list
    items.list = items.list.reduce((newList: ListItem[], currentItem) => {
      if (Array.isArray(currentItem)) {
        if (!recordsToRemove.has(currentItem)) {
          const groupItems = currentItem.filter(
            (item) => !recordsToRemove.has(item)
          );
          if (groupItems.length) {
            if (groupItems.length === 1) {
              newList.push(groupItems[0]);
            } else {
              newList.push(groupItems);
            }
          }
        }
      } else if (!recordsToRemove.has(currentItem)) {
        newList.push(currentItem);
      }
      return newList;
    }, []);

    if (resourceType === 'ResearchStudy') {
      this.updateVariables();
    }

    this.getCartChangedSubject(resourceType).next(items);
  }

  /**
   * Updates Variables in the cart when removing ResearchStudies from the cart.
   */
  updateVariables(): void {
    const researchStudies = this.itemsByResourceType['ResearchStudy']?.byId;
    const variables = this.itemsByResourceType['Variable']?.byId;
    if (researchStudies?.size && variables?.size) {
      this.removeRecords(
        'Variable',
        [...variables.values()].filter(
          (record) => !researchStudies.has((record as any).study_id)
        )
      );
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
    return this.itemsByResourceType[resourceType]?.byId.has(
      this.getResourceId(resource)
    );
  }

  /**
   * Returns list items of the specified resource type from the cart.
   * @param resourceType - resource type
   */
  getListItems(resourceType: string): ListItem[] | null {
    return this.itemsByResourceType[resourceType]?.list || null;
  }

  /**
   * Returns an observable that emits the current SelectedRecords of
   * the specified resource type when the cart for that resource type changes.
   * @param resourceType - resource type
   */
  getCartChanged(resourceType: string): Observable<ListData> {
    return this.getCartChangedSubject(resourceType).asObservable();
  }

  /**
   * Returns a subject for emitting the current SelectedRecords of the specified
   * resource type when the cart for that resource type changes.
   * @param resourceType - resource type
   */
  private getCartChangedSubject(resourceType: string): Subject<ListData> {
    if (!this.selectionChanged[resourceType]) {
      this.selectionChanged[resourceType] = new Subject<ListData>();
    }
    return this.selectionChanged[resourceType];
  }

  /**
   * Resets all selected records.
   */
  reset(): void {
    this.itemsByResourceType = {};
    this.logicalOperator = {
      ResearchStudy: 'and',
      Variable: 'and'
    };
    this.variableData = {};
    this.variableUnits = {};
  }

  /**
   * Whether the specified list item is a group of records.
   * @param listItem - list item
   */
  isGroup(listItem: ListItem): boolean {
    return Array.isArray(listItem);
  }

  /**
   * Group list items.
   * @param resourceType - resource type
   * @param itemsToGroup - set of items to group
   */
  groupItems(resourceType: string, itemsToGroup: Set<ListItem>): void {
    const items = this.itemsByResourceType[resourceType];
    const datatypeToIndex: { [datatype: string]: number } = {};

    const groupItem = (list: ListItem[], item: ListItem) => {
      const datatype = this.getVariableType(item);
      const index = datatypeToIndex[datatype];
      if (index !== undefined) {
        list[index] = [].concat(list[index], item);
      } else {
        datatypeToIndex[datatype] = list.push(item) - 1;
      }
    };

    items.list = items.list.reduce((newList: ListItem[], currentItem) => {
      if (itemsToGroup.has(currentItem)) {
        groupItem(newList, currentItem);
      } else {
        if (Array.isArray(currentItem)) {
          const restItems = currentItem.filter((i) => {
            const shouldBeGrouped = itemsToGroup.has(i);
            if (shouldBeGrouped) {
              groupItem(newList, i);
            }
            return !shouldBeGrouped;
          });
          if (restItems.length) {
            newList.push(restItems.length > 1 ? restItems : restItems[0]);
          }
        } else {
          newList.push(currentItem);
        }
      }
      return newList;
    }, []);

    itemsToGroup.clear();
    this.getCartChangedSubject(resourceType).next(items);
  }

  /**
   * Ungroup list items.
   * @param resourceType - resource type
   * @param itemsToUngroup - set of items to ungroup
   */
  ungroupItems(resourceType: string, itemsToUngroup: Set<ListItem>): void {
    const items = this.itemsByResourceType[resourceType];

    const ungroupItem = (list: ListItem[], item: ListItem) => {
      list.push(...[].concat(item));
    };

    items.list = items.list.reduce((newList: ListItem[], currentItem) => {
      if (itemsToUngroup.has(currentItem)) {
        ungroupItem(newList, currentItem);
      } else {
        if (Array.isArray(currentItem)) {
          const restItems = currentItem.filter((i) => {
            const shouldBeGrouped = itemsToUngroup.has(i);
            if (shouldBeGrouped) {
              ungroupItem(newList, i);
            }
            return !shouldBeGrouped;
          });
          if (restItems.length) {
            newList.push(restItems.length > 1 ? restItems : restItems[0]);
          }
        } else {
          newList.push(currentItem);
        }
      }
      return newList;
    }, []);

    itemsToUngroup.clear();
    this.getCartChangedSubject(resourceType).next(items);
  }

  /**
   * Updates the values of a group of variables with the value of the first variable.
   * @param varGroup - group of variables
   */
  updateVariableGroupValues(varGroup: any): void {
    for (let i = 1; i < varGroup.length; i++) {
      this.variableData[varGroup[i].id].value = {
        ...this.variableData[varGroup[0].id].value
      };
    }
  }
}
