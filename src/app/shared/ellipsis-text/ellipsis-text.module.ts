import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EllipsisTextComponent } from './ellipsis-text.component';
import { MatTooltipModule } from '@angular/material/tooltip';

@NgModule({
  declarations: [EllipsisTextComponent],
  exports: [EllipsisTextComponent],
  imports: [CommonModule, MatTooltipModule]
})
export class EllipsisTextModule {}
