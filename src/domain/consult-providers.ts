/**
 * External services behind one interface each, with a mock like Meet and eKis:
 * dictation (Dicteer), consultation transcript (Gespreksverslag), the pharmacy route
 * and secure mail to the GP. The real providers are open points; the rest of the app
 * only ever sees these contracts.
 */

export interface DictationProvider {
  /** Returns the recognised text for a recording; the mock returns a fixed sample. */
  recognise(fieldLabel: string): Promise<string>;
}

export interface TranscriptProvider {
  start(consultNoteId: string): Promise<{ recordingId: string }>;
  stop(recordingId: string): Promise<{ proposal: string }>;
}

export interface PharmacyProvider {
  send(prescriptionId: string): Promise<{ status: string }>;
  poll(prescriptionId: string): Promise<{ status: string }>;
}

export interface SecureMailProvider {
  send(input: { channel: string; recipient: string; subject: string; body: string }): Promise<{ reference: string }>;
}

export function mockDictationProvider(): DictationProvider {
  return { recognise: async (fieldLabel) => `Gedicteerde tekst voor ${fieldLabel}: patiënt geeft aan dat de klachten sinds enkele weken toenemen. Verder geen bijzonderheden.` };
}

export function mockTranscriptProvider(): TranscriptProvider {
  return {
    start: async (consultNoteId) => ({ recordingId: `rec-${consultNoteId.slice(0, 8)}` }),
    stop: async () => ({ proposal: "Voorstel gespreksverslag: hulpvraag besproken, verwachtingen afgestemd, behandelopties en risico's toegelicht. Patiënt akkoord met het voorgestelde plan." }),
  };
}

export function mockPharmacyProvider(): PharmacyProvider {
  return { send: async () => ({ status: "verstuurd" }), poll: async () => ({ status: "ontvangen" }) };
}

export function mockSecureMailProvider(): SecureMailProvider {
  return { send: async ({ channel, recipient }) => ({ reference: `mock-${channel}-${recipient.slice(0, 6)}-${Date.now()}` }) };
}
