import { Directive, ElementRef, Input } from '@angular/core';
import { CustomDialogRef } from './custom-dialog-ref';

/** Counter used to generate unique IDs for dialog elements. */
let dialogElementUid = 0;

/**
 * Directive for marking an element as a title in a dialog content template.
 */
@Directive({
  selector: '[dialogTitle]',
  host: {
    '[id]': 'id'
  }
})
export class DialogTitleDirective {
  /** Unique id for the dialog title. If none is supplied, it will be auto-generated. */
  @Input() id: string = `custom-dialog-title-${dialogElementUid++}`;

  constructor(private elementRef: ElementRef, private dialogRef: CustomDialogRef) {
    this.dialogRef.titleId = this.id;
  }

}

