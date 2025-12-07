/**
 * Copied from https://github.com/zebzhao/Angular-QueryBuilder with modifications.
 * See ../../query-builder-license.md
 */
import { Directive, TemplateRef } from '@angular/core';

@Directive({
  selector: '[queryField]',
  standalone: false
})
export class QueryFieldDirective {
  constructor(public template: TemplateRef<any>) {}
}
