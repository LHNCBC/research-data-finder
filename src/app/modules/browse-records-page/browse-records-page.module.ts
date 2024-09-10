import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowseRecordsPageComponent } from './browse-records-page.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PipesModule } from '../../shared/pipes/pipes.module';

@NgModule({
  declarations: [BrowseRecordsPageComponent],
  exports: [BrowseRecordsPageComponent],
  imports: [
    CommonModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatMenuModule,
    MatIconModule,
    MatTabsModule,
    MatButtonModule,
    ResourceTableModule,
    FormsModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatTooltipModule,
    PipesModule
  ]
})
export class BrowseRecordsPageModule {}
