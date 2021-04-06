import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FhirBackendModule } from './fhir-backend/fhir-backend.module';
import { CommonSvgIconsModule } from './common-svg-icons/common-svg-icons.module';

@NgModule({
  declarations: [],
  imports: [CommonModule, FhirBackendModule, CommonSvgIconsModule],
})
export class SharedModule {}
