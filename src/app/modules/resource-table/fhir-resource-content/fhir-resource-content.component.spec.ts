import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FhirResourceContentComponent } from './fhir-resource-content.component';
import { ToastrModule } from 'ngx-toastr';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import { DialogModule, DialogRef } from '@angular/cdk/dialog';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { BrowserModule } from '@angular/platform-browser';
import createSpyObj = jasmine.createSpyObj;

describe('FhirResourceContentComponent', () => {
  let component: FhirResourceContentComponent;
  let fixture: ComponentFixture<FhirResourceContentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        BrowserModule,
        BrowserAnimationsModule,
        ToastrModule.forRoot(),
        MatDialogModule,
        DialogModule,
        FhirResourceContentComponent
      ],
      providers: [
        {
          provide: MatDialogRef,
          useValue:
            createSpyObj('MatDialogRef', ['close', 'updatePosition'])
        },
        {
          provide: DialogRef,
          useValue: {
            overlayRef: {}
          }
        },
        {provide: MAT_DIALOG_DATA, useValue: {
          resource: {
            resourceType: 'Observation',
            id: '5'
          }
        }}
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FhirResourceContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show a resource in JSON format', async () => {
    const document = createSpyObj('Document',
      ['open', 'write', 'close']);
    spyOn(window, 'open').and.returnValue({ document } as any);
    component.openInNewWindow();
    expect(document.open).toHaveBeenCalledOnceWith();
    expect(document.write).toHaveBeenCalledOnceWith(
      jasmine.stringMatching('<title>Observation/5</title>'));
    expect(document.close).toHaveBeenCalledOnceWith();
  });

});
