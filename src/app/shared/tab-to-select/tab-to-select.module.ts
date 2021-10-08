import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabToSelectDirective } from './tab-to-select.directive';

@NgModule({
  declarations: [TabToSelectDirective],
  exports: [TabToSelectDirective],
  imports: [CommonModule]
})
export class TabToSelectModule {}
