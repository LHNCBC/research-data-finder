import { Directive, ElementRef } from '@angular/core';
import { CustomDialogRef } from './custom-dialog-ref';

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
  // Unique id for the dialog title.
  id: string;

  constructor(private elementRef: ElementRef, private dialogRef: CustomDialogRef) {
    this.id = this.dialogRef.titleId;
  }

}

