/**
 * This is a singleton service that manages OAuth2 connection state.
 */
import {Injectable} from '@angular/core';
import {FhirBackendService} from "../fhir-backend/fhir-backend.service";

@Injectable({
  providedIn: 'root'
})
export class Oauth2TokenService {
  // Whether the current server requires OAuth2 authorization
  public isOauth2Required = false;
  // Whether logged in through OAuth2
  public oauth2TokenValidated = false;

  constructor(private fhirBackend: FhirBackendService) {
    // If user is logged in and refreshes the page, we keep the login state.
    if (sessionStorage.getItem('oauth2AccessToken')) {
      this.isOauth2Required = true;
      this.oauth2TokenValidated = true;
    }
  }

  /**
   * Initiates OAuth2 login.
   */
  login(serviceBaseUrl: string): void {
    sessionStorage.setItem('oauth2LoginServer', serviceBaseUrl);
    // Contact rdf-server for OAuth2 login. '/rdf-server' queries are proxy forwarded
    // to rdf-server (see src/proxy.conf.json).
    window.location.href = `${window.location.origin}/rdf-server/oauth2/login/?server=${serviceBaseUrl}`;
  }

  /**
   * Log out.
   */
  logout(): void {
    this.oauth2TokenValidated = false;
    sessionStorage.clear();
    this.fhirBackend.fhirClient.setAuthorizationHeader(null);
  }
}
