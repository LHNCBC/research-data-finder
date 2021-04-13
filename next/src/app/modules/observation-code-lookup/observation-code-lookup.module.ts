import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ObservationCodeLookupComponent } from './observation-code-lookup.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  declarations: [ObservationCodeLookupComponent],
  exports: [ObservationCodeLookupComponent],
  imports: [
    CommonModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatIconModule
  ]
})
export class ObservationCodeLookupModule {}
