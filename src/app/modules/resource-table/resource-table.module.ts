import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResourceTableComponent } from './resource-table.component';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { TableVirtualScrollModule } from 'ng-table-virtual-scroll';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatLegacyProgressBarModule as MatProgressBarModule } from '@angular/material/legacy-progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSortModule } from '@angular/material/sort';
import {
  EllipsisTextModule
} from '../../shared/ellipsis-text/ellipsis-text.module';
import {
  ResourceTableFilterModule
} from '../resource-table-filter/resource-table-filter.module';

@NgModule({
  declarations: [ResourceTableComponent],
  exports: [ResourceTableComponent],
  imports: [
    CommonModule,
    MatIconModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatTableModule,
    MatCheckboxModule,
    FormsModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TableVirtualScrollModule,
    ScrollingModule,
    MatProgressBarModule,
    MatExpansionModule,
    ScrollingModule,
    MatSortModule,
    EllipsisTextModule,
    ResourceTableFilterModule
  ]
})
export class ResourceTableModule {}
