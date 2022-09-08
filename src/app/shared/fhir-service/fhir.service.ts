import { Injectable } from '@angular/core';
import FHIR from 'fhirclient';

@Injectable({
  providedIn: 'root'
})
export class FhirService {
  constructor() {}

  // the fhir server connection (a fhirclient/client-js instance)
  fhir = null;
  // whether a smart on FHIR connection is in progress
  connectionInProgress = false;
  // current user
  currentUser = null;

  /**
   * Get the smart on fhir connection.
   * @returns the smart on fhir connection or null
   */
  getSmartConnection(): any {
    return this.fhir;
  }

  /**
   *  Returns true if the smart connection has been requested and is in
   *  progress.
   */
  smartConnectionInProgress(): boolean {
    return this.connectionInProgress;
  }

  /**
   *  Requests a SMART on FHIR connection.  Once a connection request is in
   *  progress, further requests are ignored until a connection is
   *  established.  (So, only one request can be in progress at a time.)
   * @param callback a callback for when the connection is obtained.  If a
   *  connection request was already in progress, the callback will not be
   *  called.  If called, it will be passed a boolean indicating the success
   *  of the connection attempt.
   */
  requestSmartConnection(callback): void {
    this.fhir = null;
    if (!this.connectionInProgress) {
      this.connectionInProgress = true;
      FHIR.oauth2
        .ready()
        .then((smart) => {
          this.setSmartConnection(smart);
          this.connectionInProgress = false;
          callback(true);
        })
        .catch((e) => {
          console.log(
            'Caught error when trying to establish a SMART connection.'
          );
          console.error(e);
          callback(false);
        });
    }
  }

  /**
   * Set the smart on fhir connection
   * @param connection a connection to smart on fhir service
   */
  setSmartConnection(connection): void {
    this.fhir = connection;
  }

  /**
   * Set the current user (practitioner/patient/related persion/...)
   * Data returned through an angular broadcast event.
   * @param user the selected user
   */
  setCurrentUser(user): void {
    this.currentUser = user;
  }
}
