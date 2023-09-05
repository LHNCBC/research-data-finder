/**
 * This file contains a service with custom RxJS operators.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, pipe, UnaryFunction } from 'rxjs';
import { expand, map, takeLast } from 'rxjs/operators';
import Bundle = fhir.Bundle;
import { HttpOptions } from '../../types/http-options';
import {FhirBackendService} from "../fhir-backend/fhir-backend.service";

@Injectable({
  providedIn: 'root'
})
export class CustomRxjsOperatorsService {
  constructor(private http: HttpClient, private fhirBackend: FhirBackendService) {}

  /**
   * Returns RxJS operator to request the following sequence of resource bundle
   * pages and combine them into a single resource bundle, if the condition is true.
   * @param condition - whether to load all resources.
   * @param options - the HTTP options to send with the request.
   */
  takeAllIf(
    condition: Boolean,
    options?: HttpOptions
  ): UnaryFunction<Observable<Bundle>, Observable<Bundle>> {
    return condition ? this.takeBundleOf(Infinity, options) : pipe();
  }

  /**
   * Returns RxJS operator to request the following sequence of resource bundle
   * pages and combine them into a single resource bundle until the specified
   * amount of resources is received.
   * @param amount - amount of resources.
   * @param options - the HTTP options to send with the request.
   */
  takeBundleOf(
    amount: number,
    options?: HttpOptions
  ): UnaryFunction<Observable<Bundle>, Observable<Bundle>> {
    return pipe(
      expand((response: Bundle) => {
        const nextPageUrl = this.fhirBackend.getNextPageUrl(response);
        if (!nextPageUrl || response.entry?.length >= amount) {
          // Emit a complete notification if there is no next page
          return EMPTY;
        }
        return this.http.get<Bundle>(nextPageUrl, options).pipe(
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
