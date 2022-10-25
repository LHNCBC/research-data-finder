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
        `${window.location.protocol}//${window.location.hostname}:8110/tst-return/?tst-token=${encodedTstToken}`
      )
      .subscribe(
        (data) => {
          console.log(data);
          this.error = null;
          this.rasToken.rasTokenValidated = true;
          this.fhirBackend.serviceBaseUrl = sessionStorage.getItem(
            'dbGapRasLoginServer'
          );
          this.router.navigate(['/'], {
            queryParams: {
              'alpha-version': 'enable',
              server: this.fhirBackend.serviceBaseUrl
            }
          });
        },
        (err) => {
          this.rasToken.rasTokenValidated = false;
          this.error = err;
        }
      );
  }
}
