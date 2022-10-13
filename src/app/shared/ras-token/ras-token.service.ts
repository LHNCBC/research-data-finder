/**
 * This is a singleton service that manages RAS(OIDC) connection state.
 */
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RasTokenService {
  public rasTokenValidated = false;
}
