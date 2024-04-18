import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PullDataPageComponent } from './pull-data-page.component';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SearchParameterGroupModule } from '../search-parameter-group/search-parameter-group.module';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { EllipsisTextModule } from '../../shared/ellipsis-text/ellipsis-text.module';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { TableVirtualScrollModule } from 'ng-table-virtual-scroll';

@NgModule({
  declarations: [PullDataPageComponent],
  exports: [PullDataPageComponent],
  imports: [
    CommonModule,
    MatTabsModule,
    SearchParameterGroupModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatMenuModule,
    ResourceTableModule,
    MatCheckboxModule,
    FormsModule,
    EllipsisTextModule,
    TableVirtualScrollModule,
    ScrollingModule
  ]
})
export class PullDataPageModule {}
