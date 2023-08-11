import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-sign-in-dialog',
  templateUrl: 'sign-in-dialog.component.html'
})
export class SignInDialogComponent {
  data = {
    username: '',
    password: ''
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public server: string,
    public dialogRef: MatDialogRef<SignInDialogComponent>
  ) {}

  close(): void {
    this.dialogRef.close(this.data);
  }
}
