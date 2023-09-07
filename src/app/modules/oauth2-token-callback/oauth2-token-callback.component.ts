import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Oauth2TokenService} from "../../shared/oauth2-token/oauth2-token.service";
import {FhirBackendService} from "../../shared/fhir-backend/fhir-backend.service";
import {HttpClient} from "@angular/common/http";
import {getUrlParam} from "../../shared/utils";

@Component({
  selector: 'app-oauth2-token-callback',
  templateUrl: 'oauth2-token-callback.component.html'
})
export class Oauth2TokenCallbackComponent implements OnInit {
  error = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private oauth2Token: Oauth2TokenService,
    private fhirBackend: FhirBackendService,
    private http: HttpClient
  ) {
  }

  ngOnInit(): void {
    const code = getUrlParam('code');
    this.http
      .get(
        `${window.location.origin}/rdf-server/oauth2/callback/?code=${code}`,
        {withCredentials: true}
      )
      .subscribe((data) => {
        console.log(data);
        this.error = null;
        this.oauth2Token.oauth2TokenValidated = true;
        sessionStorage.setItem('oauth2AccessToken', data['access_token']);
        const server = sessionStorage.getItem('oauth2LoginServer');
        window.location.href = `${window.location.origin}/fhir/research-data-finder/?server=${server}`;
      }, (err) => {
        this.oauth2Token.oauth2TokenValidated = false;
        this.error = err;
      });
  }
}
