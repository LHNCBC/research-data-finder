import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpBackend, provideHttpClient, withInterceptorsFromDi }
  from '@angular/common/http';
import { FhirBackendService } from './fhir-backend.service';

@NgModule({
  declarations: [],
  imports: [CommonModule],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HttpBackend, useExisting: FhirBackendService }
  ]
})
export class FhirBackendModule {}
