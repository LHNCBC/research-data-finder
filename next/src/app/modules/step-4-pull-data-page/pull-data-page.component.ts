import { Component, OnInit } from '@angular/core';

// TODO: temporary type
export interface ResourceElement {
  col1: string;
  col2: string;
}
// TODO:
//  Import fhir types: https://www.npmjs.com/package/@types/fhir ?


/**
 * The main component for pulling Patient-related resources data
 */
@Component({
  selector: 'app-pull-data-page',
  templateUrl: './pull-data-page.component.html',
  styleUrls: ['./pull-data-page.component.less']
})
export class PullDataPageComponent implements OnInit {

  resourceColumns: string[] = ['col1', 'col2'];
  resourceDataSource: ResourceElement[] =
    Array.from({length: 50}, (v, i) => ({
      col1: `first column value - ${i}`,
      col2: `second column value - ${i}`
    }));

  constructor() { }

  ngOnInit(): void {
  }

}
