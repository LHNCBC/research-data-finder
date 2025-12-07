import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl, Validators } from '@angular/forms';

export interface ScrubberIdData {
  scrubberId: string;
  hasCancelButton: boolean;
}


@Component({
  selector: 'app-scrubber-id-dialog',
  templateUrl: './scrubber-id-dialog.component.html',
  styleUrl: './scrubber-id-dialog.component.less',
  standalone: false
})
export class ScrubberIdDialogComponent {
  hasCancelButton = false;
  scrubberId = new FormControl<string>('', {validators: Validators.required} );

  constructor(
    private dialogRef: MatDialogRef<ScrubberIdDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ScrubberIdData
  ) {
    this.scrubberId.setValue(data.scrubberId);
    this.hasCancelButton = data.hasCancelButton === true;
  }

  apply(): void {
    this.scrubberId.markAsTouched();
    if (this.scrubberId.valid) {
      this.dialogRef.close(this.scrubberId.value);
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
