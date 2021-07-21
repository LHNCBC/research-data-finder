import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObservationTestValueUnitComponent } from './observation-test-value-unit.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ObservationTestValueUnitComponent', () => {
  let component: ObservationTestValueUnitComponent;
  let fixture: ComponentFixture<ObservationTestValueUnitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ObservationTestValueUnitComponent],
      imports: [HttpClientTestingModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ObservationTestValueUnitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
