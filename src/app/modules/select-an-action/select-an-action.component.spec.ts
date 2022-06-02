import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectAnActionComponent } from './select-an-action.component';
import { configureTestingModule } from '../../../test/helpers';
import { SelectAnActionModule } from './select-an-action.module';

describe('SelectAnActionComponent', () => {
  let component: SelectAnActionComponent;
  let fixture: ComponentFixture<SelectAnActionComponent>;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [SelectAnActionComponent],
      imports: [SelectAnActionModule]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectAnActionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
