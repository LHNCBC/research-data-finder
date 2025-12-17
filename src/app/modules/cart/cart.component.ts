import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { getPluralFormOfRecordName } from '../../shared/utils';
import { ColumnDescription } from '../../types/column.description';
import {
  ColumnDescriptionsService
} from '../../shared/column-descriptions/column-descriptions.service';
import {
  ColumnValuesService
} from '../../shared/column-values/column-values.service';
import {
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { Subscription } from 'rxjs';
import { CartService, ListItem } from '../../shared/cart/cart.service';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import Resource = fhir.Resource;

type ListCells = { [key: string]: string };

/**
 * Component for displaying records in the cart.
 */
@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.less'],
  host: { class: 'mat-elevation-z4' },
  standalone: false
})
export class CartComponent implements OnInit, OnChanges {
  constructor(
    private fhirBackend: FhirBackendService,
    private columnDescriptionsService: ColumnDescriptionsService,
    private columnValuesService: ColumnValuesService,
    private liveAnnouncer: LiveAnnouncer,
    public cart: CartService
  ) {}

  // The resource type for which cart is displayed
  @Input() resourceType: string;
  // The "resource type" for display columns, e.g. observations can be treated as variables
  @Input() resourceTypeColumns: string;
  @Input() listItems: ListItem[];
  selectedItems = new Set<ListItem>();
  @Output() removeRecord = new EventEmitter<{
    resourceType: string;
    listItem: ListItem;
  }>();
  pluralFormOfRecordType: string;
  subscriptions: Subscription[] = [];

  @Input('columnDescriptions') set updateColumnDescriptions(
    columnDescriptions: ColumnDescription[]
  ) {
    if (this.resourceType === 'Variable') {
      this.columnDescriptions = columnDescriptions?.filter(
        // Exclude unnecessary columns
        (c) => c.element !== 'type' && c.element !== 'unit'
      );
    } else if (this.resourceType === 'Observation') {
      this.columnDescriptions = columnDescriptions?.filter(
        // Exclude unnecessary columns
        (c) => c.element !== 'valueQuantity.unit'
      );
    } else {
      this.columnDescriptions = columnDescriptions;
    }
  }
  columnDescriptions: ColumnDescription[];
  cells: { [id: string]: ListCells } = {};
  createRemoveGroupTooltip = "Create/Remove OR'd groups";
  selectGroupTooltip = 'Select this group of records to group/ungroup';
  selectRecordTooltip = 'Select this record to group/ungroup';
  removeGroupTooltip = 'Remove group of records from the cart';
  removeRecordTooltip = 'Remove record from the cart';

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.resourceType) {
      this.pluralFormOfRecordType = getPluralFormOfRecordName(
        this.resourceType
      );
    }

    if (changes.listItems) {
      if (this.listItems) {
        const allColumns = this.columnDescriptionsService.getAvailableColumns(
          this.resourceTypeColumns || this.resourceType,
          'select'
        );
        [].concat(...this.listItems).forEach((record: Resource) => {
          if (!this.cells[record.id]) {
            this.cells[record.id] = allColumns.reduce((desc, columnDesc) => {
              // For each column description, get string values to display in
              // a cell of a resource table
              desc[columnDesc.element] = this.columnValuesService
                .getCellStrings(record, columnDesc).join('; ');
              return desc;
            }, {} as ListCells);
          }
        });
      } else {
        this.listItems = [];
      }
    }
  }

  /**
   * Notifies the parent component to remove a record from the cart.
   * @param resourceType - resource type
   * @param listItem - list item, this can be a record or a group (array)
   *   of records.
   */
  removeRecordFromCart(resourceType: string, listItem: ListItem): void {
    this.removeRecord.next({ resourceType, listItem });
  }


  /**
   * Whether to display records in a tree view.
   */
  isTree(): boolean {
    return (
      (this.resourceType !== 'ResearchStudy' && this.listItems.length > 1) ||
      (this.listItems.length === 1 && Array.isArray(this.listItems[0]))
    );
  }

  /**
   * Selects/deselects a list item.
   * @param listItem - list item
   * @param checked - whether to select or deselect a list item.
   */
  toggleSelection(listItem: ListItem, checked: boolean): void {
    if (checked) {
      this.selectedItems.add(listItem);
    } else {
      this.selectedItems.delete(listItem);
    }
  }

  /**
   * Groups all list items with the same datatype.
   */
  groupAllItems(): void {
    this.cart.groupItems(this.resourceType, new Set(this.listItems));
    this.liveAnnouncer.announce(
      'Grouped all list items with the same datatype in the cart area below.'
    );
  }

  /**
   * Groups selected list items.
   */
  groupSelectedItems(): void {
    this.cart.groupItems(this.resourceType, this.selectedItems);
    this.liveAnnouncer.announce(
      'Grouped selected list items in the cart area below.'
    );
  }

  /**
   * Ungroups all list items.
   */
  ungroupAllItems(): void {
    this.cart.ungroupItems(this.resourceType, new Set(this.listItems));
    this.liveAnnouncer.announce(
      'Ungrouped all list items in the cart area below.'
    );
  }

  /**
   * Ungroups selected list items.
   */
  ungroupSelectedItems(): void {
    this.cart.ungroupItems(this.resourceType, this.selectedItems);
    this.liveAnnouncer.announce(
      'Ungrouped selected list items in the cart area below.'
    );
  }

  /**
   * Returns text for a cell of the cart table.
   * @param listItem - list item
   * @param element - property name of resource object for the cell data
   */
  getCellText(listItem: ListItem, element: string): string {
    let result;
    if (Array.isArray(listItem)) {
      if (
        element === 'display_name' ||
        element === 'id' ||
        element === 'code'
      ) {
        result =
          '«' +
          listItem.map((i) => this.cells[i.id][element]).join('» or «') +
          '»';
      }
    } else {
      result = this.cells[listItem.id][element];
    }
    return result || '';
  }
}
