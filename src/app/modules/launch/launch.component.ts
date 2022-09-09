import { Component, OnInit } from '@angular/core';
import FHIR from 'fhirclient';

@Component({
  selector: 'app-launch',
  templateUrl: './launch.component.html'
})
export class LaunchComponent implements OnInit {
  ngOnInit(): void {
    FHIR.oauth2.authorize({
      // For some reason, I won't get the user object after a successful SMART connection if
      // I set redirectUrl here.
      // redirectUri: '/?server=https://lforms-smart-fhir.nlm.nih.gov/v/r4/fhir',
      client_id: 'my_web_app', // hard coded client_id to work with SMART on FHIR starter server
      scope: 'openid fhirUser user/*.read'
    });
  }
}
