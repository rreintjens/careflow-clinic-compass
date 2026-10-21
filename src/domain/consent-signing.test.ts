import {expect,it} from 'vitest';
import {configuredConsent,consentSignatureSchema} from './consent-signing';
it('signing requires an actual configured consent text',()=>{expect(configuredConsent({},'botox')).toBeNull();expect(configuredConsent({consentForms:{botox:'Toestemming v1'}},'botox')).toBe('Toestemming v1');});
it('only PNG signature data is accepted',()=>{expect(consentSignatureSchema.safeParse({noteId:'00000000-0000-4000-8000-000000000001',kind:'botox',signature:'https://example.com/image'}).success).toBe(false);});