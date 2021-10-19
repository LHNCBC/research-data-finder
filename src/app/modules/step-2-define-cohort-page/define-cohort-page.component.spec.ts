import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DefineCohortPageComponent } from './define-cohort-page.component';
import { DefineCohortPageModule } from './define-cohort-page.module';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { configureTestingModule } from 'src/test/helpers';

describe('DefineCohortComponent', () => {
  let component: DefineCohortPageComponent;
  let fixture: ComponentFixture<DefineCohortPageComponent>;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [DefineCohortPageComponent],
      imports: [DefineCohortPageModule, MatIconTestingModule]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DefineCohortPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add ResearchStudy ids to search parameters', () => {
    expect(
      component.prepareCriteria({ condition: 'and', rules: [] }, [
        'someResearchStudyId'
      ])
    ).toEqual({
      condition: 'and',
      rules: [
        {
          condition: 'and',
          resourceType: 'Patient',
          rules: [
            {
              field: {
                element: '_has:ResearchSubject:individual:study',
                value: 'someResearchStudyId'
              }
            }
          ]
        }
      ]
    });
  });
});
