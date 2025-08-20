import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsPageComponent } from './settings-page.component';
import { SettingsPageModule } from './settings-page.module';
import { SharedModule } from '../../shared/shared.module';
import { configureTestingModule } from 'src/test/helpers';

describe('SettingsComponent', () => {
  let component: SettingsPageComponent;
  let fixture: ComponentFixture<SettingsPageComponent>;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [SettingsPageComponent],
      imports: [SettingsPageModule, SharedModule],
    }, {
      serverUrl: 'https://lforms-fhir.nlm.nih.gov/baseR4'
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
