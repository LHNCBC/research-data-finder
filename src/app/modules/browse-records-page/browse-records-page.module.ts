import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowseRecordsPageComponent } from './browse-records-page.component';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
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
