import { Component, OnInit } from '@angular/core';
import FHIR from 'fhirclient';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-launch',
  templateUrl: './launch.component.html'
})
export class LaunchComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    const fhirServerUrl = this.route.snapshot.paramMap.get('iss');
    FHIR.oauth2
      .authorize({
        redirectUri: `/?server=${fhirServerUrl}&isSmart=true`,
        client_id: 'my_web_app', // hard coded client_id to work with SMART on FHIR starter server
        scope: 'openid fhirUser patient/*.read',
        iss: fhirServerUrl
      })
      .catch(() => {
        this.router.navigate(['/'], {
          queryParams: { server: fhirServerUrl, isSmart: true }
        });
      });
  }
}
