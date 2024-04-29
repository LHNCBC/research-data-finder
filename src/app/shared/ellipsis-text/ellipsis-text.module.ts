import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EllipsisTextComponent } from './ellipsis-text.component';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';

@NgModule({
  declarations: [EllipsisTextComponent],
  exports: [EllipsisTextComponent],
  imports: [CommonModule, MatTooltipModule]
})
export class EllipsisTextModule {}
