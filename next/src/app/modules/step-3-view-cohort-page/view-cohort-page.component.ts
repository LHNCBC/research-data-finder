import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Bundle = fhir.Bundle;
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';

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
  url = '$fhir/Patient?_count=50';
  initialBundle: Bundle;
  showTable = false;

  constructor(
    private http: HttpClient,
    public columnDescriptions: ColumnDescriptionsService
  ) {}

  ngOnInit(): void {
    this.http.get(this.url).subscribe((data: Bundle) => {
      this.initialBundle = data;
      this.showTable = true;
    });
  }
}
