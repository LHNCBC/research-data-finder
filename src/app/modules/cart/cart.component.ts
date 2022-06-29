import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import Resource = fhir.Resource;
import { getPluralFormOfRecordName } from '../../shared/utils';
import { ColumnDescription } from '../../types/column.description';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { ColumnValuesService } from '../../shared/column-values/column-values.service';
import fhirpath from 'fhirpath';
import { filter } from 'rxjs/operators';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import fhirPathModelR4 from 'fhirpath/fhir-context/r4';
import { Subscription } from 'rxjs';
import { CartService } from '../../shared/cart/cart.service';

type ListCells = { [key: string]: string };

/**
 * Component for displaying records in the cart.
 */
@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.less']
})
export class CartComponent implements OnInit, OnChanges {
  constructor(
    private fhirBackend: FhirBackendService,
    private columnDescriptionsService: ColumnDescriptionsService,
    private columnValuesService: ColumnValuesService
  ) {
    this.subscriptions.push(
      fhirBackend.initialized
        .pipe(filter((status) => status === ConnectionStatus.Ready))
        .subscribe(() => {
          this.fhirPathModel = {
            R4: fhirPathModelR4
          }[fhirBackend.currentVersion];
          this.compiledExpressions = {};
        })
    );
  }

  @Input() resourceType: string;
  // TODO: Store this value in the cart service
  condition: 'and' | 'or' = 'and';
  @Input() records: Resource[];
  @Output() removeRecord = new EventEmitter<{
    resourceType: string;
    resource: Resource;
  }>();
  pluralFormOfRecordType: string;
  subscriptions: Subscription[] = [];

  @Input() columnDescriptions: ColumnDescription[];
  cells: { [id: string]: ListCells } = {};
  compiledExpressions: { [expression: string]: (row: Resource) => any };
  fhirPathModel: any;

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.resourceType) {
      this.pluralFormOfRecordType = getPluralFormOfRecordName(
        this.resourceType
      );
    }

    if (changes.records) {
      const allColumns = this.columnDescriptionsService.getAvailableColumns(
        this.resourceType,
        'select'
      );
      this.records.forEach((record) => {
        if (!this.cells[record.id]) {
          this.cells[record.id] = allColumns.reduce((desc, columnDesc) => {
            const cellText = this.getCellStrings(record, columnDesc).join('; ');
            desc[columnDesc.element] = cellText;
            return desc;
          }, {} as ListCells);
        }
      });
    }
  }

  /**
   * Notifies the parent component to remove a record from the cart.
   * @param resourceType - resource type
   * @param resource - record to remove
   */
  removeRecordFromCart(resourceType: string, resource: Resource): void {
    this.removeRecord.next({ resourceType, resource });
  }

  /**
   * Returns string values to display in a cell
   * @param row - data for a row of table (entry in the bundle)
   * @param column - column description
   */
  getCellStrings(row: Resource, column: ColumnDescription): string[] {
    const expression = column.expression || column.element.replace('[x]', '');
    const fullPath = expression ? this.resourceType + '.' + expression : '';

    for (const type of column.types) {
      const output = this.columnValuesService.valueToStrings(
        this.getEvaluator(fullPath)(row),
        type,
        column.isArray,
        fullPath
      );

      if (output && output.length) {
        return output;
      }
    }
    return [];
  }

  /**
   * Returns a function for evaluating the passed FHIRPath expression.
   * @param expression - FHIRPath expression
   */
  getEvaluator(expression: string): (row: Resource) => any {
    let compiledExpression = this.compiledExpressions[expression];
    if (!compiledExpression) {
      compiledExpression = fhirpath.compile(expression, this.fhirPathModel);
      this.compiledExpressions[expression] = compiledExpression;
    }
    return compiledExpression;
  }
}
