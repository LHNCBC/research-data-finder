import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldDefaultOptions
} from '@angular/material/form-field';
import { SettingsService } from './shared/settings-service/settings.service';
import { AppRoutingModule } from './app-routing.module';
import { HomeModule } from './modules/home/home.module';
import { RasTokenCallbackModule } from './modules/ras-token-callback/ras-token-callback.module';
import { LaunchModule } from './modules/launch/launch.module';
import { InitializeSpinnerModule } from './shared/initialize-spinner/initialize-spinner.module';

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
    AppRoutingModule,
    HomeModule,
    RasTokenCallbackModule,
    LaunchModule,
    InitializeSpinnerModule
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
