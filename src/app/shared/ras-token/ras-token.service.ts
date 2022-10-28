/**
 * This is a singleton service that manages RAS(OIDC) connection state.
 */
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RasTokenService {
  public rasTokenValidated = false;

  constructor() {
    // If user is logged in and refreshes the page, we keep the login state.
    if (sessionStorage.getItem('dbgapTstToken')) {
      this.rasTokenValidated = true;
    }
  }
}
