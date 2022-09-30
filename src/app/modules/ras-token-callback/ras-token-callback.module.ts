import { NgModule } from '@angular/core';
import { RasTokenCallbackComponent } from './ras-token-callback.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [RasTokenCallbackComponent],
  imports: [SharedModule]
})
export class RasTokenCallbackModule {}
