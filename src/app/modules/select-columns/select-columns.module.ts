import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectColumnsComponent } from './select-columns.component';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  declarations: [SelectColumnsComponent],
  exports: [SelectColumnsComponent],
  imports: [
    CommonModule,
    MatIconModule,
    ReactiveFormsModule,
    FormsModule,
    MatCheckboxModule,
    MatDialogModule,
    MatButtonModule
  ]
})
export class SelectColumnsModule {}
