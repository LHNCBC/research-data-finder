import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrowseRecordsPageComponent } from './browse-records-page.component';
import { configureTestingModule } from '../../../test/helpers';
import { BrowseRecordsPageModule } from './browse-records-page.module';

describe('SelectRecordsPageComponent', () => {
  let component: BrowseRecordsPageComponent;
  let fixture: ComponentFixture<BrowseRecordsPageComponent>;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [BrowseRecordsPageComponent],
      imports: [BrowseRecordsPageModule]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BrowseRecordsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
