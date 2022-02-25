import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomDialogComponent } from './custom-dialog.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';

@NgModule({
  declarations: [CustomDialogComponent],
  imports: [CommonModule, OverlayModule, BrowserAnimationsModule, A11yModule]
})
export class CustomDialogModule {}
