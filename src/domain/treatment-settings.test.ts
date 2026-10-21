import {describe,it,expect} from 'vitest';
import {treatmentSettingsSchema} from './treatment-settings';
const data={price_cents:14500,price_per:'zone',btw_rate:21,vat_exemption_possible:false,material_brand:null,material_unit:'zones',lot_required:true,supplier:null,reminder_days:90,online_booking:'bookable',dossier_template_override:null};
describe('Behandelinstellingen',()=>{
 it('geld blijft in gehele centen',()=>{expect(treatmentSettingsSchema.parse(data).price_cents).toBe(14500);expect(treatmentSettingsSchema.safeParse({...data,price_cents:14500.5}).success).toBe(false);});
 it('herinnering kan niet negatief zijn',()=>expect(treatmentSettingsSchema.safeParse({...data,reminder_days:-1}).success).toBe(false));
 it('online boeken kan uit zonder behandeling te archiveren',()=>expect(treatmentSettingsSchema.parse({...data,online_booking:'not_bookable'}).online_booking).toBe('not_bookable'));
});