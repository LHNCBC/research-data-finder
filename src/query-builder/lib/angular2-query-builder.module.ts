/**
 * Copied from https://github.com/zebzhao/Angular-QueryBuilder with modifications.
 * See ../query-builder-license.md
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, } from '@angular/forms';

import { QueryBuilderComponent } from './query-builder/query-builder.component';

import { QueryArrowIconDirective } from './query-builder/query-arrow-icon.directive';
import { QueryFieldDirective } from './query-builder/query-field.directive';
import { QueryInputDirective } from './query-builder/query-input.directive';
import { QueryEntityDirective } from './query-builder/query-entity.directive';
import { QueryOperatorDirective } from './query-builder/query-operator.directive';
import { QueryButtonGroupDirective } from './query-builder/query-button-group.directive';
import { QuerySwitchGroupDirective } from './query-builder/query-switch-group.directive';
import { QuerySwitchGroupPrefixDirective } from './query-builder/query-switch-group-prefix.directive';
import { QueryTreeContainerSuffixDirective } from './query-builder/query-tree-container-suffix.directive';
import { QueryRemoveButtonDirective } from './query-builder/query-remove-button.directive';
import { QueryEmptyWarningDirective } from './query-builder/query-empty-warning.directive';

@NgModule({
  imports: [
    CommonModule,
    FormsModule
  ],
  declarations: [
    QueryBuilderComponent,
    QueryInputDirective,
    QueryOperatorDirective,
    QueryFieldDirective,
    QueryEntityDirective,
    QueryButtonGroupDirective,
    QuerySwitchGroupDirective,
    QuerySwitchGroupPrefixDirective,
    QueryTreeContainerSuffixDirective,
    QueryRemoveButtonDirective,
    QueryEmptyWarningDirective,
    QueryArrowIconDirective
  ],
  exports: [
    QueryBuilderComponent,
    QueryInputDirective,
    QueryOperatorDirective,
    QueryFieldDirective,
    QueryEntityDirective,
    QueryButtonGroupDirective,
    QuerySwitchGroupDirective,
    QuerySwitchGroupPrefixDirective,
    QueryTreeContainerSuffixDirective,
    QueryRemoveButtonDirective,
    QueryEmptyWarningDirective,
    QueryArrowIconDirective
  ]
})
export class QueryBuilderModule { }
