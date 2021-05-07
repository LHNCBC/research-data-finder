import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * This module used for register Material icons SVG downloaded
 * from https://material.io/resources/icons
 * (Because Material icons font is not supported by IE11)
 */
const icons = [
  'keyboard_arrow_right',
  'keyboard_arrow_left',
  'cancel',
  'clear',
  'clear_all_black',
  'add',
  'refresh',
  'upload',
  'save',
  'file_download',
  'create',
  'fullscreen_black',
  'fullscreen_exit_black'
];

@NgModule({
  declarations: [],
  imports: [CommonModule]
})
export class CommonSvgIconsModule {
  constructor(
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    icons.forEach((key) => {
      this.matIconRegistry.addSvgIcon(
        key,
        this.domSanitizer.bypassSecurityTrustResourceUrl(
          `assets/${key}-24px.svg`
        )
      );
    });
  }
}
