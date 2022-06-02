import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectRecordsPageComponent } from './select-records-page.component';
import { configureTestingModule } from '../../../test/helpers';
import { SelectRecordsPageModule } from './select-records-page.module';

describe('SelectRecordsPageComponent', () => {
  let component: SelectRecordsPageComponent;
  let fixture: ComponentFixture<SelectRecordsPageComponent>;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [SelectRecordsPageComponent],
      imports: [SelectRecordsPageModule]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectRecordsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
