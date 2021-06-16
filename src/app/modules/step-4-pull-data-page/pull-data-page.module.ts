import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PullDataPageComponent } from './pull-data-page.component';
import { MatTabsModule } from '@angular/material/tabs';
import { SearchParametersModule } from '../search-parameters/search-parameters.module';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule } from '@angular/forms';

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
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatMenuModule,
    ResourceTableModule
  ]
})
export class PullDataPageModule {}
