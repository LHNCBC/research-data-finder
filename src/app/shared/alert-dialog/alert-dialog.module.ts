import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertDialogComponent } from './alert-dialog.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  declarations: [AlertDialogComponent],
  imports: [CommonModule, MatDialogModule, MatButtonModule]
})
export class AlertDialogModule {}
