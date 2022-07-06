import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { AppModule } from './app.module';
import { FhirBackendModule } from './shared/fhir-backend/fhir-backend.module';
import { SharedModule } from './shared/shared.module';
import { SettingsService } from './shared/settings-service/settings.service';
import { FhirBackendService } from './shared/fhir-backend/fhir-backend.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [AppModule, FhirBackendModule, SharedModule]
    }).compileComponents();
    const service = TestBed.inject(FhirBackendService);
    service.settings = TestBed.inject(SettingsService);
    spyOn(service.settings, 'getDbgapUrlPattern').and.returnValue(
      '^https://dbgap-api.ncbi.nlm.nih.gov/fhir'
    );
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
