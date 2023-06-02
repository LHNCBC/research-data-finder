import { NgModule } from '@angular/core';
import { PluralFormOfRecordNamePipe } from './plural-form-of-record-name.pipe';

@NgModule({
  declarations: [PluralFormOfRecordNamePipe],
  exports: [PluralFormOfRecordNamePipe]
})
export class PipesModule {}
