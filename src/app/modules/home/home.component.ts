import { AfterViewInit, Component, ViewChild } from '@angular/core';
import pkg from '../../../../package.json';
import { setUrlParam, removeUrlParam } from '../../shared/utils';
import { RasTokenService } from '../../shared/ras-token/ras-token.service';
import { StepperComponent, Step } from '../stepper/stepper.component';
import { CreateCohortMode } from '../../shared/cohort/cohort.service';
import {ConnectionStatus, FhirBackendService} from '../../shared/fhir-backend/fhir-backend.service';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import {Oauth2TokenService} from "../../shared/oauth2-token/oauth2-token.service";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.less']
})
export class HomeComponent implements AfterViewInit {
  version = pkg.version;
  @ViewChild(StepperComponent) stepperComponent: StepperComponent;

  constructor(
    public rasToken: RasTokenService,
    public fhirBackend: FhirBackendService,
    private liveAnnouncer: LiveAnnouncer,
    public oauth2Token: Oauth2TokenService
  ) {
    // Initialize FhirBackendService only on the default route which uses HomeComponent.
    fhirBackend.init();
  }

  openChangelog(): void {
    window.open(
      'https://github.com/lhncbc/fhir-obs-viewer/blob/master/CHANGELOG.md',
      '_blank',
      'noopener noreferrer'
    );
  }

  /**
   * Switch between 'alpha' and stable versions of the app.
   * Log out of RAS if it was logged in when switching.
   */
  switchVersion(): void {
    if (this.rasToken.rasTokenValidated) {
      this.rasToken.logout();
    }
    this.switchVersionUrlParam();
  }

  /**
   * Sets the "prev-version" parameter in the application URL to the opposite
   * value of the currently loaded UI. If "pre-version" = "enable" the previous
   * (legacy) UI will be used, otherwise the new table-based UI will be used.
   * @private
   */
  private switchVersionUrlParam(): void {
    if (this.fhirBackend.isPreviousVersion) {
      window.location.href = removeUrlParam('prev-version');
    } else {
      window.location.href = setUrlParam('prev-version', 'enable');
    }
  }

  /**
   * Initiate login through OAuth2.
   */
  onOauth2Login(): void {
    this.oauth2Token.login(this.fhirBackend.serviceBaseUrl);
  }

  private returnToSettingsPage(): void {
    this.stepperComponent.stepper.selectedIndex = Step.SETTINGS;
    this.stepperComponent.selectAnActionComponent?.createCohortMode.setValue(
      CreateCohortMode.UNSELECTED
    );
    this.liveAnnouncer.announce('Logged out. Returning to settings page.');
  }

  /**
   * Log out of a server connected through OAuth2.
   */
  onOauth2Logout(): void {
    this.oauth2Token.logout();
    this.returnToSettingsPage();
    // Show "Authorization required" error message below server input.
    this.fhirBackend.initialized.next(ConnectionStatus.Oauth2Required);
    this.stepperComponent.settingsPageComponent.settingsFormGroup.get('serviceBaseUrl').updateValueAndValidity();
  }

  onRasLogout(): void {
    this.rasToken.logout();
    this.returnToSettingsPage();
  }

  onSmartLogout(): void {
    window.history.pushState({}, '', setUrlParam('isSmart', 'false'));
    this.fhirBackend.isSmartOnFhir = false;
    this.liveAnnouncer.announce('Logged out from SMART on FHIR connection.');
  }

  ngAfterViewInit(): void {
    // Display shared header/footer after Angular page loads.
    document.getElementById('sharedHeader').style.display = 'block';
    document.getElementById('sharedFooter').style.display = 'block';
  }
}
