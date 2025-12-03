import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Inject
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule, MatDialogRef
} from '@angular/material/dialog';
import { MatIconButton } from '@angular/material/button';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatIcon } from '@angular/material/icon';
import { highlightJsonHtml } from '../../../shared/utils';
import { MatTooltip } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { OverlayKeyboardDispatcher } from '@angular/cdk/overlay';
import { DialogRef } from '@angular/cdk/dialog';
import Resource = fhir.Resource;


/**
 * Angular component for displaying FHIR resource content in a dialog.
 * Provides functionality to view, copy, and highlight JSON data,
 * and manages dialog stacking and keyboard event handling.
 */
@Component({
  selector: 'app-fhir-resource-content',
  standalone: true,
  imports: [
    MatDialogModule,
    DragDropModule,
    MatIconButton,
    MatIcon,
    MatTooltip
  ],
  templateUrl: './fhir-resource-content.component.html',
  styleUrl: './fhir-resource-content.component.less'
})
export class FhirResourceContentComponent implements AfterViewInit {
  // The FHIR resource object to be displayed in the dialog.
  resource: Resource;
  // The pretty-printed JSON string representation of the FHIR resource.
  jsonString: string;
  // The syntax-highlighted HTML representation of the JSON string.
  jsonHtml: string;
  // The title of the dialog, formatted as "ResourceType/ID".
  title: string;


  constructor(
    private matDialogRef: MatDialogRef<FhirResourceContentComponent>,
    private cdkDialogRef: DialogRef<any, FhirResourceContentComponent>,
    @Inject(MAT_DIALOG_DATA) data: any,
    private toastr: ToastrService,
    private keyboardDispatcher: OverlayKeyboardDispatcher,
    private elementRef: ElementRef
  ) {
    this.resource = data.resource;
    // Pretty print JSON with 2 spaces indentation
    this.jsonString = JSON.stringify(this.resource, null, 2)
    // Syntax highlight the JSON string for HTML display
    this.jsonHtml = highlightJsonHtml(this.jsonString);
    // Set the dialog title to "ResourceType/ID"
    this.title = this.resource.resourceType + '/' + this.resource.id;
  }


  /**
   * Angular lifecycle hook that runs after the component's view has been initialized.
   * Centers the dialog box on the screen by updating its position using
   * absolute pixel values. This fixes a bug where the top left corner of
   * the dialog box would change its position when the dialog box was resized.
   */
  ngAfterViewInit(): void {
    this.matDialogRef.updatePosition({
      left: Math.floor(document.documentElement.clientWidth/2 - (this.elementRef.nativeElement.parentNode.offsetWidth/2)) + 'px',
      top: Math.floor(document.documentElement.clientHeight/2 - (this.elementRef.nativeElement.parentNode.offsetHeight/2)) + 'px',
    })
  }


  /**
   * Handles the mousedown event on the dialog to manage dialog stacking order.
   * Moves the clicked dialog wrapper to the top if it is not already the topmost dialog.
   * Adds the dialog's overlay to the keyboard dispatcher for proper keyboard event handling.
   *
   * @param {Event} event - The mousedown event triggered on the dialog.
   */
  @HostListener('mousedown', ['$event'])
  onActivate(event: Event): void {
    const clickedDialogWrapper = (event.target as Element).closest(
      '.cdk-global-overlay-wrapper');
    const currentDialogWrapper =  clickedDialogWrapper.parentElement
      .querySelector('.cdk-global-overlay-wrapper:last-of-type');

    if (currentDialogWrapper && clickedDialogWrapper &&
      currentDialogWrapper !== clickedDialogWrapper) {
      this.keyboardDispatcher.add(this.cdkDialogRef.overlayRef);
      currentDialogWrapper.after(clickedDialogWrapper);
    }
  }


  /**
   * Opens the current resource JSON in a new browser window.
   * The new window is sized to 80% of the screen and centered.
   * The JSON is displayed with syntax highlighting using highlight.js.
   * After opening, the current dialog is closed.
   */
  openInNewWindow(): void {
    const width = window.screen.width * 0.8; //600;
    const height = window.screen.height * 0.8;//400;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    const wnd = window.open('', '_blank',
      `top=${top},left=${left},width=${width},height=${height},scrollbars=no,location=no`);
    wnd.document.open();
    wnd.document.write(`
<html lang="en">
  <head>
    <title>${this.title}</title>
    <link rel="stylesheet"
     href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css">
    <style>
      body, pre {
        margin: 0;
        padding: 0;
      }
      body pre code.hljs {
        padding: 0;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <pre><code class="language-json">${this.jsonHtml}</code></pre>
  </body>
</html>`);
    wnd.document.close();
    this.matDialogRef.close();
  }


  /**
   * Copies the JSON string to the clipboard and closes the dialog.
   * Shows a success toast if the copy succeeds, or an error toast if it fails.
   */
  copyAndClose(): void {
    navigator.clipboard.writeText(this.jsonString)
      .then(() => {
        this.toastr.success('JSON have been copied to clipboard.', '', {
          timeOut: 10000,
          closeButton: true,
          tapToDismiss: false
        });
        this.matDialogRef.close();
      })
      .catch(() => {
        this.toastr.error('JSON have not been copied to clipboard.', '', {
          timeOut: 10000,
          closeButton: true,
          tapToDismiss: false
        });
      });
  }
}
