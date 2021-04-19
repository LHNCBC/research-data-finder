import { Component, Input, OnInit } from '@angular/core';
import { ColumnDescription } from '../../types/column.description';
import { HttpClient } from '@angular/common/http';
import Bundle = fhir.Bundle;

/**
 * Component for viewing a cohort of Patient resources
 */
@Component({
  selector: 'app-view-cohort-page',
  templateUrl: './view-cohort-page.component.html',
  styleUrls: ['./view-cohort-page.component.less']
})
export class ViewCohortPageComponent implements OnInit {
  @Input() max = 0;
  @Input() columnDescriptions: ColumnDescription[];
  url = '$fhir/Patient?_count=50';
  initialBundle: Bundle;
  showTable = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get(this.url).subscribe((data: Bundle) => {
      this.initialBundle = data;
      this.showTable = true;
    });
  }
}
