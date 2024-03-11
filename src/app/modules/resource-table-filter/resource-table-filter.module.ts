import { NgModule } from '@angular/core';
import {
  ResourceTableFilterComponent
} from './resource-table-filter.component';
import {
  CustomDialogModule
} from '../../shared/custom-dialog/custom-dialog.module';

@NgModule({
  declarations: [ResourceTableFilterComponent],
  imports: [CustomDialogModule],
  exports: [ResourceTableFilterComponent]
})
export class ResourceTableFilterModule {
}
