/**
 * This is a singleton service that manages RAS(OIDC) connection state.
 */
import { Injectable } from '@angular/core';
import { CreateCohortMode } from '../cohort/cohort.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class RasTokenService {
  public rasTokenValidated = false;

  // A flag that is set to true only during RAS callback navigation to
  // automatically move to next steps.
  public isRasCallbackNavigation = false;

  constructor(private http: HttpClient) {
    // If user is logged in and refreshes the page, we keep the login state.
    if (sessionStorage.getItem('dbgapTstToken')) {
      this.rasTokenValidated = true;
    }
  }

  /**
   * Initiates login to RAS
   * @param serviceBaseUrl - FHIR REST API Service Base URL
   *   (See https://www.hl7.org/fhir/http.html#root)
   * @param createCohortMode - selected cohort creation mode
   */
  login(serviceBaseUrl: string, createCohortMode: CreateCohortMode): void {
    sessionStorage.setItem('dbgapRasLoginServer', serviceBaseUrl);
    // Store user's selection, so it can be restored after successful RAS connection.
    sessionStorage.setItem('selectedCreateCohortMode', createCohortMode);
    // Contact rdf-server for RAS login. '/rdf-server' queries are proxy forwarded
    // to rdf-server (see src/proxy.conf.json).
    window.location.href = `${window.location.origin}/rdf-server/login`;
  }

  /**
   * Logs out of RAS.
   * @return a promise that resolves when the logout request has completed.
   */
  logout(): Promise<void> {
    // Remove the session variable to avoid duplicate logout requests
    sessionStorage.removeItem('dbgapRasLoginServer');

    return this.rasTokenValidated
      ? this.http
          .get(`${window.location.origin}/rdf-server/logout`)
          .toPromise()
          .then(() => {
            this.rasTokenValidated = false;
            sessionStorage.clear();
          })
      : Promise.resolve();
  }
}
