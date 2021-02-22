import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DefineCohortPageComponent } from './define-cohort-page.component';
import { DefineCohortPageModule } from './define-cohort-page.module';

describe('DefineCohortComponent', () => {
  let component: DefineCohortPageComponent;
  let fixture: ComponentFixture<DefineCohortPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DefineCohortPageComponent ],
      imports: [ DefineCohortPageModule ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DefineCohortPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
