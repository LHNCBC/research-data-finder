import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScrubberIdDialogComponent } from './scrubber-id-dialog.component';
import { configureTestingModule } from '../../../test/helpers';
import { ScrubberIdDialogModule } from './scrubber-id-dialog.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

describe('ScrubberIdDialogComponent', () => {
  let component: ScrubberIdDialogComponent;
  let fixture: ComponentFixture<ScrubberIdDialogComponent>;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [ScrubberIdDialogComponent],
      imports: [ScrubberIdDialogModule],
      providers: [
        { provide: MatDialogRef, useValue: {} },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            scrubberId: null,
            hasCancelButton: false
          }
        }
      ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ScrubberIdDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });


  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
