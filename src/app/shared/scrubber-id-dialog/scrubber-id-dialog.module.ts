import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrubberIdDialogComponent } from './scrubber-id-dialog.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import {
  FormControlCollectorModule
} from '../error-manager/form-control-collector.module';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [ScrubberIdDialogComponent],
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, FormControlCollectorModule,
    MatFormField, MatInput, MatLabel, ReactiveFormsModule, MatHint
  ]
})
export class ScrubberIdDialogModule { }
