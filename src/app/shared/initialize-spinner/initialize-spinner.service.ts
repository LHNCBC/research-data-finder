import {Injectable} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {
  InitializeSpinnerComponent
} from '../../modules/step-0-settings-page/initialize-spinner/initialize-spinner.component';
import {LiveAnnouncer} from '@angular/cdk/a11y';
import {map} from 'rxjs/operators';
import {
  ConnectionStatus,
  FhirBackendService
} from '../fhir-backend/fhir-backend.service';

@Injectable({
  providedIn: 'root'
})
export class InitializeSpinnerService {
  showSpinner = false;

  /**
   * Creates and initializes an instance of InitializeSpinnerService
   * @param fhirBackend a service used to handle HTTP requests to the FHIR server
   * @param dialog a service to open Material Design modal dialogs
   * @param liveAnnouncer a service is used to announce messages for screen-reader
   *   users using an aria-live region.
   */
  constructor(
    private fhirBackend: FhirBackendService,
    private dialog: MatDialog,
    private liveAnnouncer: LiveAnnouncer
  ) {
    // Show initialization spinner when connection to server is in pending state
    this.fhirBackend.initialized
      .pipe(map((status) => status === ConnectionStatus.Pending))
      .subscribe((show) => {
        if (show) {
          this.showInitSpinner();
        } else {
          this.hideInitSpinner();
        }
      });
  }

  /**
   * Shows initialization spinner.
   */
  showInitSpinner(): void {
    this.showSpinner = true;
    this.liveAnnouncer.announce(
      'Please wait. Initializing data for the selected server.'
    );
  }

  /**
   * Hides initialization spinner.
   */
  hideInitSpinner(): void {
    this.showSpinner = false;
  }
}
