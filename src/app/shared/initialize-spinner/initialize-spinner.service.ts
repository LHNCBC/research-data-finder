import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { InitializeSpinnerComponent } from '../../modules/step-0-settings-page/initialize-spinner/initialize-spinner.component';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { map } from 'rxjs/operators';
import {
  ConnectionStatus,
  FhirBackendService
} from '../fhir-backend/fhir-backend.service';

@Injectable({
  providedIn: 'root'
})
export class InitializeSpinnerService {
  initSpinnerDialog: MatDialogRef<InitializeSpinnerComponent>;
  initAnnounceTimer = null;

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
    if (!this.initSpinnerDialog) {
      window.addEventListener('keydown', this.blockTabKey);
      this.initSpinnerDialog = this.dialog.open(InitializeSpinnerComponent, {
        panelClass: 'init-spinner-container',
        disableClose: true,
        ariaModal: true,
        restoreFocus: false
      });
      this.initSpinnerDialog.afterClosed().subscribe(() => {
        // Restore focus to the server input after server initialization.
        document.getElementById('serverBaseUrl')?.focus();
      });
      this.liveAnnouncer.announce(
        'Please wait. Initializing data for the selected server.'
      );
    }
  }

  /**
   * Hides initialization spinner.
   */
  hideInitSpinner(): void {
    if (this.initSpinnerDialog) {
      window.removeEventListener('keydown', this.blockTabKey);
      clearTimeout(this.initAnnounceTimer);
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
}
