import { Injectable, Injector } from '@angular/core';
import { Overlay, PositionStrategy, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { CustomDialogRef, CustomDialogContent } from './custom-dialog-ref';
import { CustomDialogComponent } from './custom-dialog.component';

/**
 * Type describing the parameters of the CustomDialog.open function.
 */
export type CustomDialogParams<T> = {
  origin: HTMLElement;
  content: CustomDialogContent;
  data?: T;
};

/**
 * Service for creating custom dialogs.
 * Unlike the standard MatDialog, it allows you to:
 * - create dialog that does not prevent the browser window from scrolling
 * - bind the position of the created dialog to the specified origin HTML element
 */
@Injectable({
  providedIn: 'root'
})
export class CustomDialog {
  constructor(private overlay: Overlay, private injector: Injector) {}

  open<T = any>({
    origin,
    content,
    data
  }: CustomDialogParams<T>): CustomDialogRef<T> {
    const overlayRef = this.overlay.create(this.getOverlayConfig(origin));
    const dialogRef = new CustomDialogRef<T>(overlayRef, content, data);

    const injector = Injector.create({
      parent: this.injector,
      providers: [{ provide: CustomDialogRef, useValue: dialogRef }]
    });
    overlayRef.attach(
      new ComponentPortal(CustomDialogComponent, null, injector)
    );

    return dialogRef;
  }

  private getOverlayConfig(origin: HTMLElement): OverlayConfig {
    return new OverlayConfig({
      hasBackdrop: true,
      panelClass: 'custom-overlay',
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: this.getOverlayPositionStrategy(origin),
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });
  }

  private getOverlayPositionStrategy(origin: HTMLElement): PositionStrategy {
    const originOnTheLeft =
      origin.getBoundingClientRect().left < window.innerWidth / 2;
    const originX = originOnTheLeft ? 'start' : 'end';
    const overlayX = originX;

    return this.overlay
      .position()
      .flexibleConnectedTo(origin)
      .withPositions([
        {
          originX,
          originY: 'bottom',
          overlayX,
          overlayY: 'top'
        }
      ])
      .withFlexibleDimensions(false)
      .withPush(false);
  }
}
