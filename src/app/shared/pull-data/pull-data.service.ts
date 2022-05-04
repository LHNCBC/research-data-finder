/**
 * This file contains a service for pulling data for a cohort of patients.
 */
import { Injectable } from '@angular/core';
import { SelectedObservationCodes } from '../../types/selected-observation-codes';
import { Criteria, ResourceTypeCriteria } from '../../types/search-parameters';
import { CODETEXT } from '../query-params/query-params.service';
import { CohortService } from '../cohort/cohort.service';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PullDataService {
  constructor(private cohort: CohortService) {}

  defaultObservationCodes$ = this.cohort.criteria$.pipe(
    map((criteria) =>
      this.combineObservationCodes(this.getObservationCodesFrom(criteria))
    )
  );
  /**
   * Combines the elements of the SelectedObservationCodes array into a single
   * SelectedObservationCodes object.
   */
  combineObservationCodes(
    observationCodeArray: SelectedObservationCodes[]
  ): SelectedObservationCodes {
    return observationCodeArray.reduce(
      (result, cc) => {
        cc.items.forEach((item, index) => {
          if (result.items.indexOf(item) === -1) {
            result.items.push(item);
            result.coding.push(cc.coding[index]);
          }
        });
        return result;
      },
      {
        coding: [],
        datatype: 'any',
        items: []
      }
    );
  }

  /**
   * Returns selected observation codes from specified criteria
   * @param criteria - criteria tree
   */
  private getObservationCodesFrom(
    criteria: Criteria | ResourceTypeCriteria
  ): SelectedObservationCodes[] {
    let codeFieldValues: SelectedObservationCodes[] = [];
    if ('resourceType' in criteria) {
      if (criteria.resourceType === 'Observation') {
        const foundRule = (criteria as ResourceTypeCriteria).rules.find(
          (rule) =>
            rule.field.element === CODETEXT &&
            rule.field.selectedObservationCodes
        );
        if (foundRule) {
          codeFieldValues.push(foundRule.field.selectedObservationCodes);
        }
      }
    } else {
      const length = criteria.rules.length;
      for (let i = 0; i < length; ++i) {
        codeFieldValues = codeFieldValues.concat(
          this.getObservationCodesFrom(criteria.rules[i])
        );
      }
    }

    return codeFieldValues;
  }
}
