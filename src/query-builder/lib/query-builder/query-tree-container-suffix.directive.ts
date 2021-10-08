import { Directive, TemplateRef } from '@angular/core';

/**
 * Directive for marking a custom template for the area following the search criteria tree.
 * Example:
 * <query-builder ...>
 *     <ng-container *queryTreeContainerSuffix="
 *              let ruleset; let addRule=addRule; let addRuleSet=addRuleSet;
 *              let handleDataChange=handleDataChange">
 *        <!-- custom template for the area following the search criteria tree -->
 *     </ng-container>
 * </query-builder>
 */
@Directive({selector: '[queryTreeContainerSuffix]'})
export class QueryTreeContainerSuffixDirective {
  constructor(public template: TemplateRef<any>) {}
}
