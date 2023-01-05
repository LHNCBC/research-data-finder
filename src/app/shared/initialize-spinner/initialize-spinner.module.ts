import { NgModule } from '@angular/core';
import { InitializeSpinnerComponent } from './initialize-spinner.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InitializeSpinnerService } from './initialize-spinner.service';
import { SharedModule } from '../shared.module';

@NgModule({
  declarations: [InitializeSpinnerComponent],
  imports: [SharedModule, MatDialogModule, MatProgressSpinnerModule],
  exports: [MatProgressSpinnerModule]
})
export class InitializeSpinnerModule {
  constructor(private initializeSpinner: InitializeSpinnerService) {
  }
}
