import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpBackend, HttpClientModule } from '@angular/common/http';
import { FhirBackendService } from './fhir-backend.service';

@NgModule({
  declarations: [],
  imports: [CommonModule, HttpClientModule],
  providers: [
    FhirBackendService,
    { provide: HttpBackend, useExisting: FhirBackendService },
  ],
})
export class FhirBackendModule {}
