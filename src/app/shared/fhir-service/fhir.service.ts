/**
 * This file contains a service used to establish and maintain a
 * SMART on FHIR connection client.
 */
import { Injectable } from '@angular/core';
import FHIR from 'fhirclient';

@Injectable({
  providedIn: 'root'
})
export class FhirService {
  constructor() {}

  // the fhir server connection (a fhirclient/client-js instance)
  fhir = null;

  /**
   * Get the smart on fhir connection.
   * @returns the smart on fhir connection or null
   */
  getSmartConnection(): any {
    return this.fhir;
  }

  /**
   * Requests a SMART on FHIR connection.
   * @return a Promise that will be resolved when a connection is obtained.
   */
  requestSmartConnection(): Promise<void> {
    this.fhir = null;
    return FHIR.oauth2
      .ready()
      .then((smart) => {
        this.setSmartConnection(smart);
        return Promise.resolve();
      })
      .catch((e) => {
        console.log(
          'Caught error when trying to establish a SMART connection.'
        );
        console.error(e);
        return Promise.reject();
      });
  }

  /**
   * Set the smart on fhir connection
   * @param connection a connection to smart on fhir service
   */
  setSmartConnection(connection): void {
    this.fhir = connection;
  }
}
