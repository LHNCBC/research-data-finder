import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectColumnsComponent } from './select-columns.component';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';

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
