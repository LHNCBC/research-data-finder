/**
 * Copied from https://github.com/zebzhao/Angular-QueryBuilder with modifications.
 * See ../../query-builder-license.md
 */
import { Directive, TemplateRef } from '@angular/core';

@Directive({
  selector: '[queryRemoveButton]',
  standalone: false
})
export class QueryRemoveButtonDirective {
  constructor(public template: TemplateRef<any>) {}
}
