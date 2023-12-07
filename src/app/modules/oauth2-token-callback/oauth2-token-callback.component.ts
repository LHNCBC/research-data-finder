import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Oauth2TokenService} from "../../shared/oauth2-token/oauth2-token.service";
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
    private oauth2Token: Oauth2TokenService,
    private http: HttpClient
  ) {
  }

  ngOnInit(): void {
    const code = getUrlParam('code');
    const server = sessionStorage.getItem('oauth2LoginServer');
    this.http
      .get(
        `${window.location.origin}/rdf-server/oauth2/callback/?code=${code}&server=${server}`,
        {withCredentials: true}
      )
      .subscribe((data) => {
        console.log(data);
        this.error = null;
        this.oauth2Token.isOauth2Required = true;
        this.oauth2Token.oauth2TokenValidated = true;
        sessionStorage.setItem('oauth2AccessToken', data['access_token']);
        this.router.navigate(['/'], {
          queryParams: {
            server
          },
          replaceUrl: true
        });
      }, (err) => {
        this.oauth2Token.isOauth2Required = true;
        this.oauth2Token.oauth2TokenValidated = false;
        this.error = err;
      });
  }
}
