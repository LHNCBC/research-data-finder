import { SearchParameter } from './search.parameter';

export interface SearchParameterGroup {
  resourceType?: string;
  parameters: SearchParameter[];
}
