import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { PillButton } from '@/components/PillButton';
import { portalLoginInfo, sendPortalLink } from '@/data/portal.functions';

/** Demo shortcuts use the existing single-use patient-link flow and its server test-mode gate. */
export function DemoPatientLogins() {
  const { data } = useQuery({ queryKey: ['portal-demo-logins'], queryFn: () => portalLoginInfo(), staleTime: 60_000 });
  const send = useServerFn(sendPortalLink);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!data?.demo) return null;
  const configured = data.content['demoPatients'];
  const patients = Array.isArray(configured) ? configured.flatMap(p => {
    if (!p || typeof p !== 'object' || Array.isArray(p) || typeof p['name'] !== 'string' || typeof p['email'] !== 'string') return [];
    return [{ name: p['name'], email: p['email'], profile: typeof p['profile'] === 'string' ? p['profile'] : '' }];
  }) : [];
  const login = async (email: string) => {
    if (busy) return;
    setBusy(email); setError('');
    try {
      const result = await send({ data: { email } });
      const token = result.demoLink?.split('/').at(-1);
      if (!token) throw new Error('Inloggen is niet gelukt. Probeer het later opnieuw.');
      await navigate({ to: '/mijn/link/$token', params: { token } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inloggen is niet gelukt.');
      setBusy(null);
    }
  };
  return <div className="mt-6 flex flex-col gap-2">
    {patients.map(p => <PillButton key={p.email} variant="ghost" block disabled={busy !== null}
      className="h-auto min-h-11 whitespace-normal bg-teal-light px-4 py-3 text-left"
      onClick={() => void login(p.email)}>
      <span className="w-full"><span className="block font-medium">{p.name}</span><span className="block text-xs text-muted-foreground">{p.profile}</span></span>
    </PillButton>)}
    {error && <p role="alert" className="text-sm text-warning">{error}</p>}
  </div>;
}