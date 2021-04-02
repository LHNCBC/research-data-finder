import {Component, Input, OnInit} from '@angular/core';
import {ColumnDescription} from '../../types/column.description';
import {HttpClient} from '@angular/common/http';
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
  // TODO: temporarily hard coded options
  columnDescriptions: ColumnDescription[] = [
    {
      displayName: 'ID',
      element: 'id',
      types: ['string'],
      isArray: false,
      visible: false
    },
    {
      displayName: 'Name',
      element: 'name',
      types: ['HumanName'],
      isArray: true,
      visible: false
    },
    {
      displayName: 'Gender',
      element: 'gender',
      types: ['code'],
      isArray: false,
      visible: false
    },
    {
      displayName: 'Birth Date',
      element: 'birthDate',
      types: ['date'],
      isArray: false,
      visible: false
    },
    {
      displayName: 'Deceased',
      element: 'deceased[x]',
      types: ['boolean', 'dateTime'],
      isArray: false,
      visible: false
    },
    {
      displayName: 'Address',
      element: 'address',
      types: ['Address'],
      isArray: true,
      visible: false
    }
  ];
  url = 'https://lforms-fhir.nlm.nih.gov/baseR4/Patient?_elements=id,name,birthDate,active,deceased,identifier,telecom,gender,address&_count=100';
  initialBundle: Bundle;
  showTable = false;

  constructor(
    private http: HttpClient) {
  }

  ngOnInit(): void {
    this.http.get(this.url).subscribe((data: Bundle) => {
      this.initialBundle = data;
      this.showTable = true;
    });
  }
}
