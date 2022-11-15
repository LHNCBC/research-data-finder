import { HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';

/**
 * Interface for the HTTP options object passed to HTTPClient methods.
 * See node_modules/@angular/common/http/http.d.ts
 */
export interface HttpOptions {
  headers?:
    | HttpHeaders
    | {
        [header: string]: string | string[];
      };
  context?: HttpContext;
  params?:
    | HttpParams
    | {
        [param: string]:
          | string
          | number
          | boolean
          | ReadonlyArray<string | number | boolean>;
      };
}
