/**
 * This is a singleton service that manages RAS(OIDC) connection state.
 */
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RasTokenService {
  public rasTokenValidated = false;

  // A flag that is set to true only during RAS callback navigation to
  // automatically move to next steps.
  public isRasCallbackNavigation = false;

  constructor() {
    // If user is logged in and refreshes the page, we keep the login state.
    if (sessionStorage.getItem('dbgapTstToken')) {
      this.rasTokenValidated = true;
    }
  }
}
