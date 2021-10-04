import { Directive, TemplateRef } from '@angular/core';

@Directive({selector: '[queryTreeContainerSuffix]'})
export class QueryTreeContainerSuffixDirective {
  constructor(public template: TemplateRef<any>) {}
}
