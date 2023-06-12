/**
 * This file contains a service with custom RxJS operators.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, pipe, UnaryFunction } from 'rxjs';
import { expand, map, takeLast } from 'rxjs/operators';
import { getNextPageUrl } from '../utils';
import Bundle = fhir.Bundle;

@Injectable({
  providedIn: 'root'
})
export class CustomRxjsOperatorsService {
  constructor(private http: HttpClient) {}

  /**
   * Returns RxJS operator to request the following sequence of resource bundle
   * pages and combine them into a single resource bundle, if the condition is true.
   * @param condition - whether to load all resources.
   */
  takeAllIf(
    condition: Boolean
  ): UnaryFunction<Observable<Bundle>, Observable<Bundle>> {
    return condition ? this.takeBundleOf(Infinity) : pipe();
  }

  /**
   * Returns RxJS operator to request the following sequence of resource bundle
   * pages and combine them into a single resource bundle until the specified
   * amount of resources is received.
   * @param amount - amount of resources
   */
  takeBundleOf(
    amount: number
  ): UnaryFunction<Observable<Bundle>, Observable<Bundle>> {
    return pipe(
      expand((response: Bundle) => {
        const nextPageUrl = getNextPageUrl(response);
        if (!nextPageUrl || response.entry?.length >= amount) {
          // Emit a complete notification if there is no next page
          return EMPTY;
        }
        return this.http.get<Bundle>(nextPageUrl).pipe(
          map((nextBundle) => {
            const entry = [].concat(
              response?.entry || [],
              nextBundle?.entry || []
            );
            if (entry.length > amount) {
              entry.length = amount;
            }
            return {
              link: nextBundle.link,
              entry
            } as Bundle;
          })
        );
      }),
      takeLast(1)
    );
  }
}
