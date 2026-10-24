type PatientIdentity = { patient_number: number | null; first_name: string; last_name: string; email: string | null; phone: string | null };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl');
export function filterPatientDirectory<T extends PatientIdentity>(patients: readonly T[], search: string) {
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean);
  return patients.filter(patient => {
    const text = normalize([patient.patient_number, patient.first_name, patient.last_name, patient.email, patient.phone].filter(v => v !== null).join(' '));
    return terms.every(term => text.includes(term));
  });
}