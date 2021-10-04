import { Directive, TemplateRef } from '@angular/core';

@Directive({selector: '[querySwitchGroupPrefix]'})
export class QuerySwitchGroupPrefixDirective {
  constructor(public template: TemplateRef<any>) {}
}
