import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RasTokenService } from '../../shared/ras-token/ras-token.service';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';

@Component({
  selector: 'app-ras-token-callback',
  templateUrl: 'ras-token-callback.component.html'
})
export class RasTokenCallbackComponent implements OnInit {
  constructor(
    private router: Router,
    private rasToken: RasTokenService,
    private fhirBackend: FhirBackendService
  ) {}
  ngOnInit(): void {
    this.rasToken.rasTokenValidated = true;
    this.fhirBackend.serviceBaseUrl =
      'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1';
    this.router.navigate(['/'], {
      queryParams: {
        'alpha-version': 'enable',
        server: 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
      }
    });
  }
}
