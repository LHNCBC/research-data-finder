import { Component, OnInit } from '@angular/core';
import FHIR from 'fhirclient';

@Component({
  selector: 'app-launch',
  templateUrl: './launch.component.html'
})
export class LaunchComponent implements OnInit {
  ngOnInit(): void {
    FHIR.oauth2.authorize({
      fhirServiceUrl: 'https://lforms-smart-fhir.nlm.nih.gov',
      client_id: 'my_web_app', // hard coded client_id to work with SMART on FHIR starter server
      scope: 'openid fhirUser user/*.* launch/patient'
    });
  }
}
