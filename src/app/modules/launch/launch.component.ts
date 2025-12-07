import { Component, OnInit } from '@angular/core';
import FHIR from 'fhirclient';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { getUrlParam } from '../../shared/utils';

@Component({
  selector: 'app-launch',
  templateUrl: './launch.component.html',
  standalone: false
})
export class LaunchComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fhirBackend: FhirBackendService,
    private liveAnnouncer: LiveAnnouncer
  ) {}

  ngOnInit(): void {
    const fhirServerUrl = this.route.snapshot.paramMap.get('iss');
    const redirectUri = this.route.snapshot.paramMap.get('redirectUri');
    FHIR.oauth2
      .authorize({
        redirectUri,
        client_id: 'nlm-research-data-finder',
        scope: 'openid profile patient/*.read',
        iss: fhirServerUrl
      })
      .catch((e) => {
        console.error(e);
        this.fhirBackend.initialized.next(ConnectionStatus.Error);
        this.liveAnnouncer.announce('SMART on FHIR connection failed.');
        const prevVersionParamValue = getUrlParam('prev-version');
        this.router.navigate(['/'], {
          queryParams: {
            server: fhirServerUrl,
            isSmart: false,
            ...(prevVersionParamValue
              ? {'prev-version': prevVersionParamValue}
              : {})
          }
        });
      });
  }
}
