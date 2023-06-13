/**
 * This file contains Angular pipe for transforming resource type to plural form
 * of record name (user-friendly name) for resource type.
 */
import { Pipe, PipeTransform } from '@angular/core';
import { getPluralFormOfRecordName } from '../utils';

@Pipe({
  name: 'pluralFormOfRecordName'
})
export class PluralFormOfRecordNamePipe implements PipeTransform {
  /**
   * Returns plural form of record name (user-friendly name) for a resource type.
   * @param resourceType - resource type.
   */
  transform(resourceType: string): string {
    return getPluralFormOfRecordName(resourceType);
  }
}
