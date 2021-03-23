import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResourceTableComponent } from './resource-table.component';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import {MatTableModule} from "@angular/material/table";
import {MatCheckboxModule} from "@angular/material/checkbox";



@NgModule({
  declarations: [ ResourceTableComponent ],
  exports: [ ResourceTableComponent ],
  imports: [
    CommonModule,
    MatIconModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatTableModule,
    MatCheckboxModule
  ]
})
export class ResourceTableModule { }
