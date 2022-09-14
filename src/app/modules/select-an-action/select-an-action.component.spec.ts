import {
  ComponentFixture,
  fakeAsync,
  TestBed,
  tick
} from '@angular/core/testing';

import { SelectAnActionComponent } from './select-an-action.component';
import { configureTestingModule } from '../../../test/helpers';
import { SelectAnActionModule } from './select-an-action.module';
import {
  CohortService,
  CreateCohortMode
} from '../../shared/cohort/cohort.service';
import { RouterTestingModule } from '@angular/router/testing';

describe('SelectAnActionComponent', () => {
  let component: SelectAnActionComponent;
  let fixture: ComponentFixture<SelectAnActionComponent>;
  let cohort: CohortService;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [SelectAnActionComponent],
      imports: [SelectAnActionModule, RouterTestingModule]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectAnActionComponent);
    cohort = TestBed.inject(CohortService);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should recreate the following steps when the action is changed', fakeAsync(() => {
    component.createCohortMode.setValue(CreateCohortMode.BROWSE);
    expect(cohort.createCohortMode).toBe(CreateCohortMode.UNSELECTED);
    tick();
    expect(cohort.createCohortMode).toBe(CreateCohortMode.BROWSE);
  }));
});
