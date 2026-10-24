import { describe, expect, it } from 'vitest';
import { filterPatientDirectory } from './patient-directory';
const patients = [
  { patient_number: 1000009, first_name: 'Sanne', last_name: 'de Vries', email: 'sanne@example.test', phone: '0612345678' },
  { patient_number: 1000010, first_name: 'Mark', last_name: 'Visser', email: 'mark@example.test', phone: null },
];
describe('patient directory', () => {
  it('shows every patient without any date condition', () => expect(filterPatientDirectory(patients, '')).toEqual(patients));
  it('finds a patient by their full name', () => expect(filterPatientDirectory(patients, 'Sanne de Vries')).toEqual([patients[0]]));
  it('finds patient numbers, email and phone', () => {
    for (const search of ['1000009', 'sanne@example.test', '0612345678']) expect(filterPatientDirectory(patients, search)).toEqual([patients[0]]);
  });
  it('supports one-letter search and no matching results', () => {
    expect(filterPatientDirectory(patients, 'v')).toEqual(patients);
    expect(filterPatientDirectory(patients, 'nobody')).toEqual([]);
  });
});