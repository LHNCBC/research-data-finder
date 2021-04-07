import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewCohortPageComponent } from './view-cohort-page.component';
import { ViewCohortPageModule } from './view-cohort-page.module';

describe('ViewCohortComponent', () => {
  let component: ViewCohortPageComponent;
  let fixture: ComponentFixture<ViewCohortPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ViewCohortPageComponent],
      imports: [ViewCohortPageModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewCohortPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
