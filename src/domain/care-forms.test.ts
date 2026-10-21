import {describe,it,expect} from 'vitest';
import {careFormSchema,frozenCareForm,frozenAftercare} from './care-forms';
describe('Bevroren formulieren',()=>{
 it('bewaart de ondertekende tekst en versie onafhankelijk van nieuwe live tekst',()=>{
  const snapshot={consents:{botox:{text:'Oorspronkelijke toestemming',versionId:'00000000-0000-4000-8000-000000000001'}},aftercare:'Oorspronkelijke nazorg'};
  expect(frozenCareForm(snapshot,'botox')).toEqual({text:'Oorspronkelijke toestemming',versionId:'00000000-0000-4000-8000-000000000001'});
  expect(frozenAftercare(snapshot)).toBe('Oorspronkelijke nazorg');
 });
 it('ontbrekende versiegegevens zijn geen geldige bevroren toestemming',()=>expect(frozenCareForm({},'botox')).toBeNull());
 it('accepteert uitsluitend toestemming of nazorg als soort',()=>expect(careFormSchema.safeParse({id:null,code:'test',kind:'other',templateId:null,name:'Test',textNl:'Tekst',textEn:''}).success).toBe(false));
});