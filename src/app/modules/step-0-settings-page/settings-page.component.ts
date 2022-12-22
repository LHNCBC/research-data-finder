import { Component, OnDestroy } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { Observable, Subscription } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { setUrlParam } from '../../shared/utils';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { InitializeSpinnerComponent } from './initialize-spinner/initialize-spinner.component';
import { LiveAnnouncer } from '@angular/cdk/a11y';

const TIMEOUT_FOR_INIT_ANNOUNCEMENT = 1000;

/**
 * Settings page component for defining general parameters such as FHIR REST API Service Base URL.
 */
@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.less']
})
export class SettingsPageComponent implements OnDestroy {
  settingsFormGroup: UntypedFormGroup;
  subscriptions: Subscription[] = [];
  initSpinnerDialog: MatDialogRef<InitializeSpinnerComponent>;
  initAnnounceTimer = null;

  constructor(
    private formBuilder: UntypedFormBuilder,
    public fhirBackend: FhirBackendService,
    private dialog: MatDialog,
    private liveAnnouncer: LiveAnnouncer
  ) {
    // Show initialization spinner when connection to server is in pending state
    this.subscriptions.push(
      fhirBackend.initialized
        .pipe(map((status) => status === ConnectionStatus.Pending))
        .subscribe((show) => {
          if (show) {
            this.showInitSpinner();
          } else {
            this.hideInitSpinner();
          }
        })
    );

    this.settingsFormGroup = this.formBuilder.group({
      serviceBaseUrl: new UntypedFormControl(this.fhirBackend.serviceBaseUrl, {
        validators: Validators.required,
        asyncValidators: this.serviceBaseUrlValidator.bind(this)
      }),
      apiKey: [''],
      maxRequestsPerBatch: [
        this.fhirBackend.maxRequestsPerBatch,
        Validators.required
      ],
      maxActiveRequests: [
        this.fhirBackend.maxActiveRequests,
        Validators.required
      ],
      cacheDisabled: [!this.fhirBackend.cacheEnabled]
    });
    this.settingsFormGroup
      .get('serviceBaseUrl')
      .statusChanges.pipe(filter((s) => s === 'VALID'))
      .subscribe(() => {
        const server = this.settingsFormGroup.get('serviceBaseUrl').value;
        if (!this.fhirBackend.isSmartOnFhir) {
          // Update url query params after valid server change
          window.history.pushState(
            {},
            '',
            setUrlParam('isSmart', 'false', setUrlParam('server', server))
          );
        }
      });
  }

  /**
   * Shows initialization spinner.
   */
  showInitSpinner(): void {
    if (!this.initSpinnerDialog) {
      this.initAnnounceTimer = setTimeout(() => {
        this.liveAnnouncer.announce(
          'Please wait - initializing data for the selected server.'
        );
      }, TIMEOUT_FOR_INIT_ANNOUNCEMENT);

      window.addEventListener('keydown', this.blockTabKey);
      this.initSpinnerDialog = this.dialog.open(InitializeSpinnerComponent, {
        panelClass: 'init-spinner-container',
        disableClose: true,
        ariaModal: true
      });
    }
  }

  /**
   * Hides initialization spinner.
   */
  hideInitSpinner(): void {
    if (this.initSpinnerDialog) {
      window.removeEventListener('keydown', this.blockTabKey);
      clearTimeout(this.initAnnounceTimer);
      this.liveAnnouncer.announce('Initialization complete.', 'assertive');
      this.initSpinnerDialog.close();
      this.initSpinnerDialog = null;
    }
  }

  /**
   * Disables the Tab key.
   * Angular Material has an issue with focus trapping in a modal dialog:
   * Users can focus on the browser address string using mouse and after that
   * move focus to an element outside the dialog using the TAB key. This is bad
   * for the initialization spinner. The easiest way to avoid this is to disable
   * the Tab key for a while. The right way is to fix this behavior for modal
   * dialogs in AngularMaterial
   * (See https://material.angular.io/cdk/a11y/overview#focustrap).
   * @param event - keyboard event
   */
  blockTabKey(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault();
    }
  }

  /**
   * Update FHIR REST API Service configuration parameter from input field by name.
   * @param name - parameter name
   * @param value - parameter value
   */
  updateFhirBackendSetting(name: string, value?: any): void {
    const newValue =
      value !== undefined ? value : this.settingsFormGroup.get(name).value;
    this.fhirBackend[name] = newValue;
  }

  /**
   * Updates and validates the server base URL
   * @param control - FormControl instance associated with the input field
   */
  serviceBaseUrlValidator(
    control: UntypedFormControl
  ): Observable<ValidationErrors | null> {
    // Update serverBaseUrl (ignore trailing backslashes)
    this.fhirBackend.serviceBaseUrl = control.value.replace(/\/+$/, '');

    // Wait for response to validate server
    return this.fhirBackend.initialized.pipe(
      filter((status) => status !== ConnectionStatus.Pending),
      take(1),
      map((status) => {
        if (!this.fhirBackend.isSmartOnFhir) {
          this.settingsFormGroup
            .get('maxRequestsPerBatch')
            .setValue(this.fhirBackend.maxRequestsPerBatch);
          this.settingsFormGroup
            .get('maxActiveRequests')
            .setValue(this.fhirBackend.maxActiveRequests);
        }
        return status !== ConnectionStatus.Error
          ? null
          : this.fhirBackend.isSmartOnFhir
          ? { smartConnectionFailure: true }
          : { wrongUrl: true };
      })
    );
  }

  /**
   * Performs cleanup when a component instance is destroyed.
   */
  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }
}
