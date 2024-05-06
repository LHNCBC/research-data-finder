import { Component, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';

export interface AlertData {
  header: string;
  content: string;
  hasCancelButton: boolean;
}

@Component({
  selector: 'app-alert-dialog',
  templateUrl: 'alert-dialog.component.html'
})
export class AlertDialogComponent {
  header: string;
  content: string;
  hasCancelButton = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: AlertData) {
    this.header = data.header;
    this.content = data.content;
    this.hasCancelButton = data.hasCancelButton === true;
  }
}
