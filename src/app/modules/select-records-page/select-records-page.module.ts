import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectRecordsPageComponent } from './select-records-page.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { ResourceTableModule } from '../resource-table/resource-table.module';
import { CartModule } from '../cart/cart.module';
import { SearchParameterGroupModule } from '../search-parameter-group/search-parameter-group.module';
import { MatCheckboxModule } from '@angular/material/checkbox';

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
    FormsModule
  ]
})
export class SelectRecordsPageModule {}
