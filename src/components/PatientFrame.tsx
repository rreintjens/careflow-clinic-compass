/**
 * Mobile-first patient screens (booking, questionnaire, manage appointment): full-bleed on a
 * phone, on desktop a centred card with rounded corners on a sand backdrop, like the reference.
 */
export function PatientFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-background sm:bg-sand sm:px-4 sm:py-10">
      <div className="flex min-h-screen w-full max-w-[390px] flex-col bg-background sm:min-h-[calc(100vh-5rem)] sm:rounded-[24px] sm:border sm:border-mist sm:shadow-[0_8px_24px_rgba(57,51,46,0.10)]">
        {children}
      </div>
    </div>
  );
}
