/**
 * Copied from https://github.com/zebzhao/Angular-QueryBuilder with modifications.
 * See ../../query-builder-license.md
 */
import { Directive, TemplateRef } from '@angular/core';

@Directive({
  selector: '[querySwitchGroup]',
  standalone: false
})
export class QuerySwitchGroupDirective {
  constructor(public template: TemplateRef<any>) {}
}
