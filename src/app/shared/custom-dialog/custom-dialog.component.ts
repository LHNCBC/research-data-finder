import { Component, OnInit, TemplateRef } from '@angular/core';
import { CustomDialogRef, CustomDialogContent } from './custom-dialog-ref';

/**
 * The component used to display the contents of the dialog.
 */
@Component({
  templateUrl: './custom-dialog.component.html',
  styleUrls: ['./custom-dialog.component.less'],
  standalone: false
})
export class CustomDialogComponent implements OnInit {
  renderMethod: 'template' | 'component' | 'text' = 'component';
  content: CustomDialogContent;
  context;

  constructor(public dialogRef: CustomDialogRef) {
  }

  ngOnInit(): void {
    this.content = this.dialogRef.content;

    if (typeof this.content === 'string') {
      this.renderMethod = 'text';
    }

    if (this.content instanceof TemplateRef) {
      this.renderMethod = 'template';
      this.context = {
        close: this.dialogRef.close.bind(this.dialogRef)
      };
    }
  }
}
