import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectAnActionComponent } from './select-an-action.component';
import { MatRadioModule } from '@angular/material/radio';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [SelectAnActionComponent],
  exports: [SelectAnActionComponent],
  imports: [CommonModule, MatRadioModule, ReactiveFormsModule]
})
export class SelectAnActionModule {}
