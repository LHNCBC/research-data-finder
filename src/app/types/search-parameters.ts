import { SearchParameter } from './search.parameter';

export interface Criterion {
  field: SearchParameter;
}

export interface ResourceTypeCriteria {
  condition: 'and' | 'or';
  resourceType: string;
  rules: Array<Criterion>;
  total?: number;
}

export interface Criteria {
  condition: 'and' | 'or';
  rules: Array<Criteria | ResourceTypeCriteria>;
  total?: number;
}
