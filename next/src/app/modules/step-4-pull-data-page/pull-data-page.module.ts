import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PullDataPageComponent } from './pull-data-page.component';
import { MatTabsModule } from '@angular/material/tabs';
import { SearchParametersModule } from '../search-parameters/search-parameters.module';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  declarations: [PullDataPageComponent],
  exports: [PullDataPageComponent],
  imports: [
    CommonModule,
    MatTabsModule,
    SearchParametersModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatButtonModule
  ]
})
export class PullDataPageModule {}
