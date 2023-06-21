import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RasTokenService } from '../../shared/ras-token/ras-token.service';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { HttpClient } from '@angular/common/http';
import { getUrlParam } from '../../shared/utils';

@Component({
  selector: 'app-ras-token-callback',
  templateUrl: 'ras-token-callback.component.html'
})
export class RasTokenCallbackComponent implements OnInit {
  error = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private rasToken: RasTokenService,
    private fhirBackend: FhirBackendService,
    private http: HttpClient
  ) {}
  ngOnInit(): void {
    const encodedTstToken = getUrlParam('tst-token');
    this.http
      .get(
        `${window.location.origin}/rdf-server/tst-return/?tst-token=${encodedTstToken}`,
        { withCredentials: true }
      )
      .subscribe(
        (data) => {
          console.log(data);
          this.error = null;
          this.rasToken.rasTokenValidated = true;
          this.rasToken.isRasCallbackNavigation = true;
          sessionStorage.setItem('dbgapTstToken', data['message']['tst']);
          const server = sessionStorage.getItem('dbgapRasLoginServer');
          const {
            apiKey,
            maxRequestsPerBatch,
            maxActiveRequests,
            cacheDisabled
          } = JSON.parse(sessionStorage.getItem('settings'));
          this.fhirBackend.apiKey = apiKey;
          this.fhirBackend.maxRequestsPerBatch = maxRequestsPerBatch;
          this.fhirBackend.maxActiveRequests = maxActiveRequests;
          this.fhirBackend.cacheEnabled = !cacheDisabled;
          this.fhirBackend.serviceBaseUrl = server;
          this.router.navigate(['/'], {
            queryParams: {
              'alpha-version': 'enable',
              server
            },
            replaceUrl: true
          });
        },
        (err) => {
          this.rasToken.rasTokenValidated = false;
          this.error = err;
        }
      );
  }
}
