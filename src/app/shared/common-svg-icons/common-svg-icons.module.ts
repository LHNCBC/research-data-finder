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
  'add_shopping_cart_black',
  'shopping_cart_black',
  'keyboard_arrow_right',
  'keyboard_arrow_left',
  'keyboard_double_arrow_down_black',
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
  'fullscreen_exit_black',
  'search',
  'filter_list',
  'filter_outlined',
  'filter_filled',
  'info',
  'settings',
  'remove_done_black',
  'more_vert'
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
        this.domSanitizer.bypassSecurityTrustResourceUrl(`assets/${key}.svg`)
      );
    });
  }
}
