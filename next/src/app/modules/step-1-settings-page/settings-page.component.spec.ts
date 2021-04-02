import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsPageComponent } from './settings-page.component';
import { SettingsPageModule } from './settings-page.module';
import { SharedModule } from '../../shared/shared.module';

describe('SettingsComponent', () => {
  let component: SettingsPageComponent;
  let fixture: ComponentFixture<SettingsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsPageComponent ],
      imports: [ SettingsPageModule, SharedModule ]
    })
    .compileComponents();
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
