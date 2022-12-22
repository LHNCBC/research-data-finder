import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InitializeSpinnerComponent } from './initialize-spinner.component';

describe('InitializeSpinnerComponent', () => {
  let component: InitializeSpinnerComponent;
  let fixture: ComponentFixture<InitializeSpinnerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InitializeSpinnerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(InitializeSpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
