import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {RasTokenService} from '../../shared/ras-token/ras-token.service';
import {HttpClient} from '@angular/common/http';
import {getUrlParam} from '../../shared/utils';

@Component({
  selector: 'app-ras-token-callback',
  templateUrl: 'ras-token-callback.component.html',
  standalone: false
})
export class RasTokenCallbackComponent implements OnInit {
  error = null;

  constructor(
    private router: Router,
    private rasToken: RasTokenService,
    private http: HttpClient
  ) {
  }

  ngOnInit(): void {
    const encodedTstToken = getUrlParam('tst-token');
    if (encodedTstToken) {
      this.http
        .get(
          `${window.location.origin}/rdf-server/tst-return/?tst-token=${encodedTstToken}`,
          {withCredentials: true}
        )
        .subscribe(
          (data) => {
            console.log(data);
            this.error = null;
            this.rasToken.rasTokenValidated = true;
            sessionStorage.setItem('dbgapTstToken', data['message']['tst']);
          },
          (err) => {
            this.error = err.error || 'TST decode error';
            this.rasToken.rasTokenValidated = false;
            this.rasToken.errorMessage = this.error;
          },
          () => {
            this.goToStepper();
          }
        );
    } else {
      this.error = getUrlParam('error') || 'RAS error';
      this.rasToken.rasTokenValidated = false;
      this.rasToken.errorMessage = this.error;
      this.goToStepper();
    }
  }

  /**
   * Navigate back to the stepper.
   */
  private goToStepper(): void {
    this.rasToken.isRasCallbackNavigation = true;
    const server = sessionStorage.getItem('dbgapRasLoginServer');
    this.router.navigate(['/'], {
      queryParams: {
        server
      },
      replaceUrl: true
    });
  }
}
