import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignInDialogComponent } from './sign-in-dialog.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [SignInDialogComponent],
  imports: [CommonModule, MatDialogModule, MatButtonModule, FormsModule]
})
export class SignInDialogModule {}
