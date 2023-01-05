import { NgModule } from '@angular/core';
import { LaunchComponent } from './launch.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [LaunchComponent],
  imports: [SharedModule]
})
export class LaunchModule {}
