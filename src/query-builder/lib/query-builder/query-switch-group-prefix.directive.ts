import { Directive, TemplateRef } from '@angular/core';

/**
 * Directive for marking a custom template for the area preceding the AND/OR buttons.
 * Example:
 * <query-builder ...>
 *     <ng-container *querySwitchGroupPrefix="
 *              let ruleset; let removeRuleSet=removeRuleSet">
 *        <!-- custom template for the area preceding the AND/OR buttons -->
 *     </ng-container>
 * </query-builder>
 */
@Directive({
  selector: '[querySwitchGroupPrefix]',
  standalone: false
})
export class QuerySwitchGroupPrefixDirective {
  constructor(public template: TemplateRef<any>) {}
}
