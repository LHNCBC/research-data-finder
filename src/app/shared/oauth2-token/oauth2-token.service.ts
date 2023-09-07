/**
 * This is a singleton service that manages OAuth2 connection state.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class Oauth2TokenService {
  public oauth2TokenValidated = false;

  constructor(private http: HttpClient) {
    // If user is logged in and refreshes the page, we keep the login state.
    if (sessionStorage.getItem('oauth2Token')) {
      this.oauth2TokenValidated = true;
    }
  }

  /**
   * Initiates OAuth2 login.
   */
  login(serviceBaseUrl: string): void {
    sessionStorage.setItem('oauth2LoginServer', serviceBaseUrl);
    // Contact rdf-server for RAS login. '/rdf-server' queries are proxy forwarded
    // to rdf-server (see src/proxy.conf.json).
    window.location.href = `${window.location.origin}/rdf-server/oauth2/login`;
  }
}
