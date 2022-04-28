import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnnounceIfActiveDirective } from './announce-if-active.directive';

@NgModule({
  declarations: [AnnounceIfActiveDirective],
  exports: [AnnounceIfActiveDirective],
  imports: [CommonModule]
})
export class AnnounceIfActiveModule {}
