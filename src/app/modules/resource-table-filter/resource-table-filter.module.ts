import { NgModule } from '@angular/core';
import { ResourceTableFilterComponent } from './resource-table-filter.component';
import { MatDialogModule } from '@angular/material/dialog';

@NgModule({
  declarations: [ResourceTableFilterComponent],
  exports: [ResourceTableFilterComponent],
  imports: [MatDialogModule]
})
export class ResourceTableFilterModule {}
