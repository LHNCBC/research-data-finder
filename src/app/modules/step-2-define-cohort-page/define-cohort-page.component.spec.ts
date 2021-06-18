import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DefineCohortPageComponent } from './define-cohort-page.component';
import { DefineCohortPageModule } from './define-cohort-page.module';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { MatIconTestingModule } from '@angular/material/icon/testing';

describe('DefineCohortComponent', () => {
  let component: DefineCohortPageComponent;
  let fixture: ComponentFixture<DefineCohortPageComponent>;
  const spies = [];
  spies.push(jasmine.createSpyObj('HttpClient', ['get']));
  spies[0].get.and.returnValue(of({}));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DefineCohortPageComponent],
      imports: [DefineCohortPageModule, MatIconTestingModule],
      providers: [
        {
          provide: FhirBackendService,
          useValue: {
            initialized: new BehaviorSubject(ConnectionStatus.Ready)
          }
        },
        { provide: HttpClient, useValue: spies[0] }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DefineCohortPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit no more than max number of patients', async (done) => {
    component.patientStream = new Subject<fhir.Resource>();
    const nextSpy = spyOn(component.patientStream, 'next');
    Promise.all([
      component.checkPatient([], '', 3, 1),
      component.checkPatient([], '', 3, 2),
      component.checkPatient([], '', 3, 3),
      component.checkPatient([], '', 3, 4),
      component.checkPatient([], '', 3, 5)
    ]).then(() => {
      expect(component.patientCount).toEqual(3);
      expect(nextSpy).toHaveBeenCalledTimes(3);
      done();
    });
  });
});
