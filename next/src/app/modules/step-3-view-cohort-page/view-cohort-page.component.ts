import {Component, OnInit} from '@angular/core';
import {ColumnDescription} from '../../types/column.description';

/**
 * Component for viewing a cohort of Patient resources
 */
@Component({
  selector: 'app-view-cohort-page',
  templateUrl: './view-cohort-page.component.html',
  styleUrls: ['./view-cohort-page.component.less']
})
export class ViewCohortPageComponent implements OnInit {
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

  constructor() {
  }

  ngOnInit(): void {
  }
}
