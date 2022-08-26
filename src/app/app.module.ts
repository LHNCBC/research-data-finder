import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { StepperModule } from './modules/stepper/stepper.module';
import { SharedModule } from './shared/shared.module';
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldDefaultOptions
} from '@angular/material/form-field';
import { HttpClientModule } from '@angular/common/http';
import { SettingsService } from './shared/settings-service/settings.service';
import { MatMenuModule } from '@angular/material/menu';

const appearance: MatFormFieldDefaultOptions = {
  appearance: 'outline'
};

/**
 * Application initializer.
 * See https://angular.io/api/core/APP_INITIALIZER for details.
 */
function initializeApp(settingsService: SettingsService): () => Promise<any> {
  return () => settingsService.loadJsonConfig().toPromise();
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    SharedModule,
    HttpClientModule,
    StepperModule,
    MatMenuModule
  ],
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: appearance
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [SettingsService],
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
