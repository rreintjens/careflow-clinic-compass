import {describe,it,expect} from 'vitest';
import {statsCredential} from './stats-access';
describe('Data-API sleutel',()=>{
 it('accepteert uitsluitend een sleutel in de header',()=>expect(statsCredential(new Request('https://clinic.test/api/public/stats',{headers:{'x-api-key':'test-key'}}))).toBe('test-key'));
 it('weigert sleutels in het webadres, ook met een geldige header',()=>expect(statsCredential(new Request('https://clinic.test/api/public/stats?key=test-key',{headers:{'x-api-key':'test-key'}}))).toBeNull());
 it('weigert een ontbrekende sleutel',()=>expect(statsCredential(new Request('https://clinic.test/api/public/stats'))).toBeNull());
});