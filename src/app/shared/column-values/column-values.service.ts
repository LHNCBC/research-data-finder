import { Injectable } from '@angular/core';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';
import Identifier = fhir.Identifier;
import CodeableConcept = fhir.CodeableConcept;
import Coding = fhir.Coding;
import Reference = fhir.Reference;
import Period = fhir.Period;
import ContactPoint = fhir.ContactPoint;
import Quantity = fhir.Quantity;
import HumanName = fhir.HumanName;
import Address = fhir.Address;

@Injectable({
  providedIn: 'root'
})
export class ColumnValuesService {
  private get definitions(): any {
    return this.fhirBackend.getCurrentDefinitions();
  }

  constructor(private fhirBackend: FhirBackendService) {}

  /**
   * Returns array of string represented the specified value
   * or throws an exception (for unsupported types).
   * @param value - value
   * @param type - type of value
   * @param isArray - true if max cardinality greater than 1
   * @param fullPath - property path to value started with resourceType
   */
  valueToStrings(
    value: any,
    type: string,
    isArray: boolean = false,
    fullPath: string
  ): string[] {
    const singleValueFn = this.getValueFn(type);

    if (isArray) {
      if (value && value.length) {
        return (
          value
            .map((item) => singleValueFn.apply(this, [item, fullPath]))
            // remove empty strings
            .filter((item) => item)
        );
      } else {
        return [];
      }
    }

    return value !== undefined
      ? [singleValueFn.apply(this, [value, fullPath])]
      : [];
  }

  /**
   * Returns a function to get the column value
   * or undefined (for unsupported types).
   * @param type - type of value
   */
  getValueFn(
    type: string
  ): (element: any, fullPath?: string) => string | undefined {
    return {
      Identifier: this.getIdentifierAsText,
      code: this.getCodeAsText,
      CodeableConcept: this.getCodeableConceptAsText,
      string: this.identity,
      Reference: this.getReferenceAsText,
      Period: this.getPeriodAsText,
      dateTime: this.identity,
      canonical: this.identity,
      uri: this.identity,
      ContactPoint: this.getContactPointAsText,
      Quantity: this.getQuantityAsText,
      decimal: this.identity,
      Money: this.getMoneyAsText,
      boolean: this.identity,
      instant: this.identity,
      Coding: this.getCodingAsText,
      Duration: this.getQuantityAsText,
      date: this.identity,
      HumanName: this.getHumanNameAsText,
      Address: this.getAddressAsText
    }[type];
  }

  /**
   * Returns a textual representation of "Identifier" value
   * see https://www.hl7.org/fhir/datatypes.html#Identifier
   */
  getIdentifierAsText(v: Identifier): string {
    return v.value;
  }

  /**
   * Returns a textual representation of "code" value
   * see https://www.hl7.org/fhir/datatypes.html#code
   * @param v - value of type "code"
   * @param fullPath - property path to value started with resourceType
   */
  getCodeAsText(v: string, fullPath: string): string {
    const valueSet =
      this.definitions.valueSetMapByPath[fullPath] instanceof Object
        ? this.definitions.valueSetMapByPath[fullPath]
        : null;
    return (valueSet && valueSet[v]) || v;
  }

  /**
   * Returns value as is. No transformation needed.
   * @param v - value
   */
  identity(v: any): string {
    return String(v);
  }

  /**
   * Returns a textual representation of "CodeableConcept" value
   * see https://www.hl7.org/fhir/datatypes.html#CodeableConcept
   * @param v - value of type "CodeableConcept"
   * @param fullPath - property path to value started with resourceType
   */
  getCodeableConceptAsText(v: CodeableConcept, fullPath?: string): string {
    if (v.text) {
      return v.text;
    }
    return v.coding && v.coding[0]
      ? this.getCodingAsText(v.coding[0], fullPath ? fullPath + '.coding' : '')
      : null;
  }

  /**
   * Returns a textual representation of "Coding" value
   * see https://www.hl7.org/fhir/datatypes.html#Coding
   * @param v - value of type "Coding"
   * @param fullPath - property path to value started with resourceType
   */
  getCodingAsText(v: Coding, fullPath: string): string {
    if (v.display) {
      return v.display;
    }

    const valueSet =
      fullPath && this.definitions.valueSetMapByPath[fullPath] instanceof Object
        ? this.definitions.valueSetMapByPath[fullPath]
        : null;
    return (valueSet && valueSet[v.code]) || v.code;
  }

  /**
   * Returns a textual representation of "Reference" value
   * see https://www.hl7.org/fhir/references.html#Reference
   * @param v - value of type "Reference"
   */
  getReferenceAsText(v: Reference): string {
    if (v.display) {
      return v.display;
    } else if (v.reference) {
      return v.reference;
    } else if (v.identifier) {
      return this.getIdentifierAsText(v.identifier);
    }

    return null;
  }

  /**
   * Returns a textual representation of "Period" value
   * see https://www.hl7.org/fhir/datatypes.html#Period
   * @param v - value of type "Period"
   */
  getPeriodAsText(v: Period): string {
    if (v.start || v.end) {
      return `${v.start || ''}–${v.end || ''}`;
    } else {
      return null;
    }
  }

  /**
   * Returns a textual representation of "ContactPoint" value
   * see https://www.hl7.org/fhir/datatypes.html#ContactPoint
   * @param v - value of type "ContactPoint"
   */
  getContactPointAsText(v: ContactPoint): string {
    return v.value;
  }

  /**
   * Returns a textual representation of "Quantity" value
   * see https://www.hl7.org/fhir/datatypes.html#Quantity
   * @param v - value of type "Quantity"
   */
  getQuantityAsText(v: Quantity): string {
    return v.value != null ? v.value + (v.unit ? ' ' + v.unit : '') : null;
  }

  /**
   * Returns a textual representation of "Money" value
   * see https://www.hl7.org/fhir/datatypes.html#Money
   * @param v - value of type "Money"
   */
  getMoneyAsText(v: any): string {
    return v.value != null ? v.value + ' ' + v.currency : null;
  }

  /**
   * Returns a textual representation of "HumanName" value
   * https://www.hl7.org/fhir/datatypes.html#HumanName
   * @param v - value of type "HumanName"
   */
  getHumanNameAsText(v: HumanName): string {
    let rtn;

    if (v) {
      const given = v.given || [];
      const firstName = given[0] || '';
      const lastName = v.family || '';
      let middleName = given[1] || '';

      if (middleName.length === 1) {
        middleName += '.';
      }
      rtn = [firstName, middleName, lastName].filter((item) => item).join(' ');
    }

    return rtn || null;
  }

  /**
   * Returns a textual representation of "Address" value
   * https://www.hl7.org/fhir/datatypes.html#Address
   * @param v - value of type "Address"
   * @param fullPath - property path to value started with resourceType
   */
  getAddressAsText(v: Address, fullPath): string {
    const addressString = [v.line, v.city, v.state, v.postalCode, v.country]
      .filter((item) => item)
      .join(', ');
    return v.use
      ? `${
          this.definitions.valueSetMapByPath[fullPath + '.use'] instanceof
          Object
            ? this.definitions.valueSetMapByPath[fullPath + '.use'][v.use]
            : v.use
        }: ${addressString}`
      : addressString;
  }
}
