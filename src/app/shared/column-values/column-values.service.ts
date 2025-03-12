/**
 * This file contains a service for retrieving the values of the resource table cells.
 */
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
import { SettingsService } from '../settings-service/settings.service';
import { ColumnDescription } from '../../types/column.description';
import Resource = fhir.Resource;

interface CodeableReference {
  reference?: Reference;
  concept?: CodeableConcept;
}

// Cell value retrieval context
interface Context {
  // Property path to value starting with resourceType.
  fullPath?: string;
  // Coding system for filtering data in resource cell.
  preferredCodeSystem?: string;
  // A map of selected Observation codes at "pull data" step.
  pullDataObservationCodes?: Map<string, string>;
}

@Injectable({
  providedIn: 'root'
})
export class ColumnValuesService {
  private get definitions(): any {
    return this.fhirBackend.getCurrentDefinitions();
  }

  constructor(
    private fhirBackend: FhirBackendService,
    private settings: SettingsService
  ) {
  }


  /**
   * Returns string values to display in a cell of a resource table
   * @param row - data for a row of table (entry in the bundle)
   * @param column - column description
   * @param pullDataObservationCodes a map of selected Observation codes at "pull data" step
   */
  getCellStrings(
    row: Resource,
    column: ColumnDescription,
    pullDataObservationCodes: Map<string, string> = undefined
  ): string[] {
    const expression = column.expression || column.element.replace('[x]', '');
    const fullPath = expression ? row.resourceType + '.' + expression : '';

    for (const type of column.types) {
      const output = this.valueToStrings(
        this.fhirBackend.getEvaluator(fullPath)(row),
        type,
        fullPath,
        pullDataObservationCodes
      );

      if (output && output.length) {
        return output;
      }
    }
    return [];
  }


  /**
   * Returns array of string represented the specified value
   * or throws an exception (for unsupported types).
   * @param value - value
   * @param type - type of value
   * @param fullPath - property path to value started with resourceType
   * @param pullDataObservationCodes a map of selected Observation codes at "pull data" step
   */
  valueToStrings(
    value: Array<any>,
    type: string,
    fullPath: string,
    pullDataObservationCodes: Map<string, string> = undefined
  ): string[] {
    const singleValueFn = this.getValueFn(type);

    // If there is a coding with specified "preferredCodeSystem", then the rest
    // of the terms will be dropped when displaying a value for that column.
    const preferredCodeSystem =
      type === 'CodeableConcept' || type === 'CodeableConceptCode'
        ? this.settings.get(`preferredCodeSystem.${fullPath}`)
        : '';

    if (value && value.length) {
      // Filter values by preferred code system
      if (preferredCodeSystem) {
        const filteredValues = value
          .map((item) =>
            singleValueFn.apply(this, [
              item,
              pullDataObservationCodes
                ? {
                    fullPath,
                    preferredCodeSystem,
                    pullDataObservationCodes
                  }
                : {
                    fullPath,
                    preferredCodeSystem
                  }
            ])
          )
          // remove empty strings
          .filter((item) => item);

        if (filteredValues.length > 0) {
          // If there are values filtered by preferred code system,
          // return those values
          return filteredValues;
        }
      }

      return (
        value
          .map((item) =>
            singleValueFn.apply(this, [
              item,
              pullDataObservationCodes
                ? { fullPath, pullDataObservationCodes }
                : { fullPath }
            ])
          )
          // remove empty strings
          .filter((item) => item)
      );
    } else {
      return [];
    }
  }

  /**
   * Returns a function to get the column value
   * or undefined (for unsupported types).
   * @param type - type of value
   */
  getValueFn(
    type: string
  ): (element: any, { fullPath }: Context) => string | undefined {
    return {
      Identifier: this.getIdentifierAsText,
      code: this.getCodeAsText,
      CodeableConcept: this.getCodeableConceptAsText,
      CodeableConceptCode: this.getCodeableConceptCode,
      string: this.identity,
      Reference: this.getReferenceAsText,
      CodeableReference: this.getCodeableReferenceAsText,
      Period: this.getPeriodAsText,
      dateTime: this.identity,
      canonical: this.identity,
      uri: this.identity,
      ContactPoint: this.getContactPointAsText,
      Count: this.getQuantityAsText,
      Quantity: this.getQuantityAsText,
      decimal: this.identity,
      unsignedInt: this.identity,
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
  getCodeAsText(v: string, { fullPath }: Context): string {
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
   * Returns the code of the "CodeableConcept" value
   * @param v - value of type "CodeableConcept"
   * @param context - context in which we get the cell value
   * @param context.preferredCodeSystem - coding system for filtering data in resource cell
   * @param context.pullDataObservationCodes - a map of selected Observation codes at "pull data" step
   * @return code of a proper coding in the list, returns null if the coding list is empty
   */
  getCodeableConceptCode(v: CodeableConcept, context: Context = {}): string {
    const { preferredCodeSystem, pullDataObservationCodes } = context;
    let coding = v.coding || [];

    if (preferredCodeSystem) {
      const preferredCodings = coding.filter(
        ({ system }) => system === preferredCodeSystem
      );
      if (preferredCodings.length) {
        coding = preferredCodings;
      }
    }

    if (!coding.length) {
      return null;
    }

    // Find a coding that matches context.pullDataObservationCodes, or use the first coding.
    const matchingCoding =
      pullDataObservationCodes &&
      coding.find((x) => pullDataObservationCodes.has(x.code));
    return matchingCoding ? matchingCoding.code : coding[0].code;
  }

  /**
   * Returns a textual representation of "CodeableConcept" value
   * see https://www.hl7.org/fhir/datatypes.html#CodeableConcept
   * @param v - value of type "CodeableConcept"
   * @param context - context in which we get the cell value
   * @param context.fullPath - property path to value started with resourceType
   * @param context.preferredCodeSystem - coding system for filtering data in resource cell
   * @param context.pullDataObservationCodes - a map of selected Observation codes at "pull data" step
   */
  getCodeableConceptAsText(v: CodeableConcept, context: Context = {}): string {
    const { fullPath, preferredCodeSystem } = context;
    let coding = v.coding || [];

    if (preferredCodeSystem) {
      const preferredCodings = coding.filter(
        ({ system }) => system === preferredCodeSystem
      );
      if (preferredCodings.length) {
        coding = preferredCodings;
      }
    } else if (v.text) {
      return v.text;
    }

    if (!coding.length) {
      return null;
    }

    // Find a coding that matches context.pullDataObservationCodes, or use the first coding.
    const matchingCoding =
      context.pullDataObservationCodes &&
      coding.find((x) => context.pullDataObservationCodes.has(x.code));
    return matchingCoding
      ? context.pullDataObservationCodes.get(matchingCoding.code)
      : this.getCodingAsText(coding[0], {
          fullPath: fullPath ? fullPath + '.coding' : ''
        });
  }

  /**
   * Returns a textual representation of "Coding" value
   * see https://www.hl7.org/fhir/datatypes.html#Coding
   * @param v - value of type "Coding"
   * @param fullPath - property path to value started with resourceType
   */
  getCodingAsText(v: Coding, { fullPath }: Context): string {
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
    // Organization reference may have an acronym in the "reference" property,
    // for example:
    // {reference: "Organization/NLM", type: "Organization", display: "National Library of Medicine"}
    if (
      v.reference &&
      v.display &&
      /Organization\/([A-Z]+)/.test(v.reference)
    ) {
      const acronym = RegExp.$1;
      // A simple check to see if it's an acronym of the "display" value:
      const acronymChars = acronym.split('');
      const upperCaseChars = v.display.match(/([A-Z])/g);
      let pos = 0;
      if (
        acronymChars.every(
          (ch) => (pos = upperCaseChars.indexOf(ch, pos)) !== -1
        )
      ) {
        return acronym;
      }
    }
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
   * Returns a textual representation of "CodeableReference" value
   * see https://www.hl7.org/fhir/references.html#CodeableReference
   * @param v - value of type "CodeableReference"
   * @param context - context in which we get the cell value
   */
  getCodeableReferenceAsText(v: CodeableReference, context: Context = {}): string {
    if (v.reference) {
      return this.getReferenceAsText(v.reference);
    } else if (v.concept) {
      if (context.fullPath) {
        return this.getCodeableConceptAsText(v.concept, {
          ...context,
          fullPath: context.fullPath + '.concept'
        });
      } else {
        return this.getCodeableConceptAsText(v.concept, context);
      }
    }
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
    return v.value != null
      ? v.value + (v.unit ? ' ' + v.unit.replace(/(^'|'$)/g, '') : '')
      : null;
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
  getAddressAsText(v: Address, { fullPath }: Context): string {
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
