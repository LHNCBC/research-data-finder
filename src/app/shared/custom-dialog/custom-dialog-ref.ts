import { OverlayRef } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import { TemplateRef, Type } from '@angular/core';

/**
 * Custom dialog content type.
 */
export type CustomDialogContent = TemplateRef<any> | Type<any> | string;

/**
 * Reference to a dialog opened via the CustomDialog service
 * (like MatDialogRef for MatDialog).
 */
export class CustomDialogRef<T = any> {
  private afterClosed = new Subject<T>();
  afterClosed$ = this.afterClosed.asObservable();
  // The identifier of the HTML element with the "dialogTitle" attribute,
  // used as the value for "aria-labelledby".
  titleId: string;

  constructor(
    public overlay: OverlayRef,
    public content: CustomDialogContent,
    public data: T
  ) {
  }

  close(data?: T): void {
    this.overlay.dispose();
    this.afterClosed.next(data);
    this.afterClosed.complete();
  }
}
