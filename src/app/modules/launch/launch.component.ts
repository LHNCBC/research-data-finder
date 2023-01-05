import { Component, OnInit } from '@angular/core';
import FHIR from 'fhirclient';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';

@Component({
  selector: 'app-launch',
  templateUrl: './launch.component.html'
})
export class LaunchComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fhirBackend: FhirBackendService
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
        this.router.navigate(['/'], {
          queryParams: { server: fhirServerUrl, isSmart: false }
        });
      });
  }
}
