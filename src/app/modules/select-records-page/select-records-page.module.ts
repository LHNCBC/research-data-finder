import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectRecordsPageComponent } from './select-records-page.component';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { CartModule } from '../cart/cart.module';
import { SearchParameterGroupModule } from '../search-parameter-group/search-parameter-group.module';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyRadioModule as MatRadioModule } from '@angular/material/legacy-radio';
import { FormControlCollectorModule } from '../../shared/error-manager/form-control-collector.module';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { PipesModule } from '../../shared/pipes/pipes.module';
import {
  SearchParametersModule
} from '../search-parameters/search-parameters.module';

@NgModule({
  declarations: [SelectRecordsPageComponent],
  exports: [SelectRecordsPageComponent],
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
    CartModule,
    SearchParameterGroupModule,
    MatCheckboxModule,
    FormsModule,
    MatRadioModule,
    FormControlCollectorModule,
    MatExpansionModule,
    MatTooltipModule,
    PipesModule,
    SearchParametersModule
  ]
})
export class SelectRecordsPageModule {}
