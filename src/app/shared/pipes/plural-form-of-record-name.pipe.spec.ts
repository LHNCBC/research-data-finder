import { PluralFormOfRecordNamePipe } from './plural-form-of-record-name.pipe';

describe('PluralFormOfRecordNamePipe', () => {
  it('create an instance', () => {
    const pipe = new PluralFormOfRecordNamePipe();
    expect(pipe).toBeTruthy();
  });

  it('should transform resource type to plural form of record name', () => {
    const pipe = new PluralFormOfRecordNamePipe();
    expect(pipe.transform('ResearchStudy')).toBe('Studies');
  });
});
