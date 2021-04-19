import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FhirBackendModule } from './fhir-backend/fhir-backend.module';
import { CommonSvgIconsModule } from './common-svg-icons/common-svg-icons.module';
import { ColumnDescriptionsModule } from './column-descriptions/column-descriptions.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FhirBackendModule,
    CommonSvgIconsModule,
    ColumnDescriptionsModule
  ]
})
export class SharedModule {}
