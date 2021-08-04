import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControlCollectorDirective } from './form-control-collector.directive';

@NgModule({
  declarations: [FormControlCollectorDirective],
  exports: [FormControlCollectorDirective],
  imports: [CommonModule]
})
export class FormControlCollectorModule {}
