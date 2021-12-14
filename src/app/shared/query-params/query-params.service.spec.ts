import { TestBed } from '@angular/core/testing';
import { QueryParamsService } from './query-params.service';
import { SharedModule } from '../shared.module';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';

describe('QueryParamsService', () => {
  let service: QueryParamsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SharedModule]
    });
    service = TestBed.inject(QueryParamsService);
    const fhirBackendService = TestBed.inject(FhirBackendService);
    fhirBackendService.fhirClient._features = {
      evidenceVariables: [
        {
          fullUrl:
            'https://lforms-fhir.nlm.nih.gov/baseR4/EvidenceVariable/phv00492039',
          resource: {
            version: 'v1.p1',
            name: 'ENV_SMOKE_pretrial',
            description: 'Home exposure to smoke prior to trial enrollment'
          }
        },
        {
          fullUrl:
            'https://lforms-fhir.nlm.nih.gov/baseR4/EvidenceVariable/phv00492036',
          resource: {
            version: 'v1.p1',
            name: 'clinic_city',
            description:
              'City of the clinic. The following is the map of FHIR1 clinics to FHIR1 clinic_city: if clinic=5 then clinic_city=8; if clinic=6 then clinic_city=10; if clinic=7 then clinic_city=11; if clinic=8 then clinic_city=12; else clinic_city=clinic'
          }
        }
      ]
    };
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get query param for evidence variable', () => {
    const result = service.getQueryParam('EvidenceVariable', {
      element: 'name',
      value: 'ENV_SMOKE'
    });
    expect(result).toEqual(
      '&evidencevariable=https://lforms-fhir.nlm.nih.gov/baseR4/EvidenceVariable/phv00492039'
    );
  });
});
