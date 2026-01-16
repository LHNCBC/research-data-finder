import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CohortSummaryComponent, DistributionConfig } from './cohort-summary.component';
import { FhirBackendService } from 'src/app/shared/fhir-backend/fhir-backend.service';
import { configureTestingModule } from 'src/test/helpers';
import Patient = fhir.Patient;

describe('CohortSummaryComponent', () => {
  let component: CohortSummaryComponent;
  let fixture: ComponentFixture<CohortSummaryComponent>;
  let fhirBackend: FhirBackendService;

  const mockPatients: Patient[] = [
    {
      resourceType: 'Patient',
      id: '1',
      gender: 'male',
      birthDate: '1990-05-15',
      address: [{ state: 'CA' }]
    },
    {
      resourceType: 'Patient',
      id: '2',
      gender: 'female',
      birthDate: '1985-08-20',
      address: [{ state: 'NY' }]
    },
    {
      resourceType: 'Patient',
      id: '3',
      gender: 'male',
      birthDate: '2010-03-10',
      address: [{ state: 'CA' }]
    },
    {
      resourceType: 'Patient',
      id: '4',
      gender: 'other',
      birthDate: '1975-12-01',
      address: [{ state: 'TX' }]
    }
  ];

  beforeEach(async () => {
    await configureTestingModule({
      imports: [CohortSummaryComponent]
    });

    fixture = TestBed.createComponent(CohortSummaryComponent);
    fhirBackend = TestBed.inject(FhirBackendService);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Basic Distribution Calculation', () => {
    it('should calculate gender distribution correctly', () => {
      // Setup mock FHIRPath evaluator
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.gender]);

      const config: DistributionConfig = {
        id: 'gender',
        title: 'Gender Distribution',
        fhirPathExpression: 'gender'
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('gender');

      expect(items.length).toBe(3);
      expect(items.find((i) => i.key === 'male')?.value).toBe(2);
      expect(items.find((i) => i.key === 'female')?.value).toBe(1);
      expect(items.find((i) => i.key === 'other')?.value).toBe(1);
      expect(items.find((i) => i.key === 'male')?.percentage).toBe(50);
    });

    it('should calculate state distribution correctly', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.address?.[0]?.state]);

      const config: DistributionConfig = {
        id: 'state',
        title: 'State Distribution',
        fhirPathExpression: 'address.first().state'
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('state');

      expect(items.length).toBe(3);
      expect(items.find((i) => i.key === 'CA')?.value).toBe(2);
      expect(items.find((i) => i.key === 'NY')?.value).toBe(1);
      expect(items.find((i) => i.key === 'TX')?.value).toBe(1);
    });

    it('should handle empty patient list', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue(() => []);

      const config: DistributionConfig = {
        id: 'gender',
        title: 'Gender',
        fhirPathExpression: 'gender'
      };

      component.patients = [];
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: [], previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('gender');
      expect(items.length).toBe(0);
    });
  });

  describe('Label Mapping', () => {
    it('should apply label mapping correctly', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.gender]);

      const config: DistributionConfig = {
        id: 'gender',
        title: 'Gender Distribution',
        fhirPathExpression: 'gender',
        labelMap: {
          male: '♂️ Male',
          female: '♀️ Female',
          other: '⚧️ Other'
        }
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('gender');

      expect(items.find((i) => i.key === '♂️ Male')).toBeDefined();
      expect(items.find((i) => i.key === '♀️ Female')).toBeDefined();
      expect(items.find((i) => i.key === '⚧️ Other')).toBeDefined();
    });

    it('should apply label prefix and suffix', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.gender]);

      const config: DistributionConfig = {
        id: 'gender',
        title: 'Gender',
        fhirPathExpression: 'gender',
        labelPrefix: 'Gender: ',
        labelSuffix: ' patients'
      };

      component.patients = [mockPatients[0]];
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: [mockPatients[0]], previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('gender');
      expect(items[0].key).toBe('Gender: male patients');
    });
  });

  describe('Grouping Strategies', () => {
    it('should group ages by decades', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => {
        const birthYear = parseInt(patient.birthDate?.substring(0, 4) || '0');
        const age = 2025 - birthYear;
        return [age];
      });

      const config: DistributionConfig = {
        id: 'age',
        title: 'Age',
        fhirPathExpression: 'age()',
        grouping: 'age-decades'
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('age');

      expect(items.some((i) => i.key === '30 - 39')).toBe(true); // 1990, 1985
      expect(items.some((i) => i.key === '10 - 19')).toBe(true); // 2010
      expect(items.some((i) => i.key === '40 - 49')).toBe(true); // 1975
    });

    it('should group ages by categories', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => {
        const birthYear = parseInt(patient.birthDate?.substring(0, 4) || '0');
        const age = 2025 - birthYear;
        return [age];
      });

      const config: DistributionConfig = {
        id: 'age',
        title: 'Age Categories',
        fhirPathExpression: 'age()',
        grouping: 'age-categories'
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('age');

      expect(items.find((i) => i.key === 'Pediatric (0-17)')?.value).toBe(1);
      expect(items.find((i) => i.key === 'Adult (18-64)')?.value).toBe(3);
    });

    it('should group ages by custom ranges', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => {
        const birthYear = parseInt(patient.birthDate?.substring(0, 4) || '0');
        const age = 2025 - birthYear;
        return [age];
      });

      const config: DistributionConfig = {
        id: 'age',
        title: 'Age Groups',
        fhirPathExpression: 'age()',
        grouping: 'age-ranges',
        groupingRanges: [
          { max: 17, label: 'Youth' },
          { max: 40, label: 'Middle Age' },
          { max: 999, label: 'Senior' }
        ]
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('age');

      expect(items.find((i) => i.key === 'Youth')?.value).toBe(1);
      expect(items.find((i) => i.key === 'Middle Age')?.value).toBe(2);
      expect(items.find((i) => i.key === 'Senior')?.value).toBe(1);
    });

    it('should group boolean values', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.deceasedBoolean ?? false]);

      const config: DistributionConfig = {
        id: 'deceased',
        title: 'Deceased',
        fhirPathExpression: 'deceased.exists()',
        grouping: 'boolean'
      };

      component.patients = [
        { ...mockPatients[0], deceasedBoolean: true },
        { ...mockPatients[1], deceasedBoolean: false },
        mockPatients[2]
      ];
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: component.patients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('deceased');

      expect(items.find((i) => i.key === 'Yes')).toBeDefined();
      expect(items.find((i) => i.key === 'No')).toBeDefined();
    });
  });

  describe('Sorting Strategies', () => {
    it('should sort by count descending by default', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.gender]);

      const config: DistributionConfig = {
        id: 'gender',
        title: 'Gender',
        fhirPathExpression: 'gender'
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('gender');

      expect(items[0].key).toBe('male'); // 2 occurrences
      expect(items[0].value).toBe(2);
    });

    it('should sort by count ascending', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.gender]);

      const config: DistributionConfig = {
        id: 'gender',
        title: 'Gender',
        fhirPathExpression: 'gender',
        sorting: 'count-asc'
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('gender');

      expect(items[0].value).toBe(1);
      expect(items[items.length - 1].value).toBe(2);
    });

    it('should sort by label ascending', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.gender]);

      const config: DistributionConfig = {
        id: 'gender',
        title: 'Gender',
        fhirPathExpression: 'gender',
        sorting: 'label-asc'
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('gender');

      expect(items[0].key).toBe('female');
      expect(items[1].key).toBe('male');
      expect(items[2].key).toBe('other');
    });

    it('should sort by label descending', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.gender]);

      const config: DistributionConfig = {
        id: 'gender',
        title: 'Gender',
        fhirPathExpression: 'gender',
        sorting: 'label-desc'
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('gender');

      expect(items[0].key).toBe('other');
      expect(items[1].key).toBe('male');
      expect(items[2].key).toBe('female');
    });
  });

  describe('Filtering Options', () => {
    it('should exclude null values when configured', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.address?.[0]?.state]);

      const patientsWithNull = [...mockPatients, { resourceType: 'Patient' as const, id: '5' }];

      const config: DistributionConfig = {
        id: 'state',
        title: 'State',
        fhirPathExpression: 'address.first().state',
        excludeNull: true
      };

      component.patients = patientsWithNull;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: patientsWithNull, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('state');

      expect(items.find((i) => i.key === 'Unknown')).toBeUndefined();
      expect(items.length).toBe(3);
    });

    it('should limit items with maxItems', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.address?.[0]?.state]);

      const config: DistributionConfig = {
        id: 'state',
        title: 'Top 2 States',
        fhirPathExpression: 'address.first().state',
        maxItems: 2
      };

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('state');

      expect(items.length).toBe(2);
      expect(items[0].key).toBe('CA'); // Most common
    });
  });

  describe('Error Handling', () => {
    it('should handle FHIRPath evaluation errors gracefully', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue(() => {
        throw new Error('FHIRPath error');
      });

      const config: DistributionConfig = {
        id: 'test',
        title: 'Test',
        fhirPathExpression: 'invalid.path'
      };

      spyOn(console, 'warn');

      component.patients = mockPatients;
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: mockPatients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('test');

      expect(items.length).toBe(0);
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('Percentage Calculation', () => {
    it('should calculate percentages correctly with rounding', () => {
      spyOn(fhirBackend, 'getEvaluator').and.returnValue((patient: Patient) => [patient.gender]);

      const config: DistributionConfig = {
        id: 'gender',
        title: 'Gender',
        fhirPathExpression: 'gender'
      };

      // 3 patients: 33.33%, 33.33%, 33.33% should round properly
      component.patients = [
        mockPatients[0], // male
        mockPatients[1], // female
        mockPatients[3] // other
      ];
      component.distributions = [config];
      component.ngOnChanges({
        patients: { currentValue: component.patients, previousValue: [], firstChange: true, isFirstChange: () => true },
        distributions: { currentValue: [config], previousValue: [], firstChange: true, isFirstChange: () => true }
      });

      const items = component.getDistributionItems('gender');

      items.forEach((item) => {
        expect(item.percentage).toBe(33.33);
      });
    });
  });
});
