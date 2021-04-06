import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PullDataPageComponent } from './pull-data-page.component';
import { PullDataPageModule } from './pull-data-page.module';
import { SharedModule } from '../../shared/shared.module';

describe('PullDataForCohortComponent', () => {
  let component: PullDataPageComponent;
  let fixture: ComponentFixture<PullDataPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PullDataPageComponent],
      imports: [PullDataPageModule, SharedModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PullDataPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
