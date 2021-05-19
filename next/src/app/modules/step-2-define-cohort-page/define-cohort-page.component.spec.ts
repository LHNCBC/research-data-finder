import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DefineCohortPageComponent } from './define-cohort-page.component';
import { DefineCohortPageModule } from './define-cohort-page.module';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { BehaviorSubject, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';

describe('DefineCohortComponent', () => {
  let component: DefineCohortPageComponent;
  let fixture: ComponentFixture<DefineCohortPageComponent>;
  const spies = [];
  spies.push(jasmine.createSpyObj('HttpClient', ['get']));
  spies[0].get.and.returnValue(of({}));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DefineCohortPageComponent],
      imports: [DefineCohortPageModule],
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
});
