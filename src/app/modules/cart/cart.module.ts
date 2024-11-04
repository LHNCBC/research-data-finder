import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartComponent } from './cart.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SearchParameterModule } from '../search-parameter/search-parameter.module';
import { EllipsisTextModule } from '../../shared/ellipsis-text/ellipsis-text.module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';

@NgModule({
  declarations: [CartComponent],
  exports: [CartComponent],
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    FormsModule,
    SearchParameterModule,
    ReactiveFormsModule,
    EllipsisTextModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatMenuModule
  ]
})
export class CartModule {}
