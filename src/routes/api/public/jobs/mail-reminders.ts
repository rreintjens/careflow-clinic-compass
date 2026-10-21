import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { treatmentReminderDue } from '@/domain/portal-treatment';
import { readStepData } from '@/domain/consult-steps';

/** Hourly: appointment and medical-questionnaire reminders, timed by each brand's settings; one per appointment. */
export const Route = createFileRoute("/api/public/jobs/mail-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { admin } = await import("@/data/booking.server");
        const { safeQueue } = await import("@/data/mailer.server");
        const {appointmentPreparation}=await import("@/data/appointment-preparation.server");
        const db = await admin();
        const { data: tenants } = await db.from("tenants").select("id");
        let queued = 0;
        for (const t of tenants ?? []) {
          const { data: st } = await db.from("settings").select("key, value").eq("tenant_id", t.id).in("key", ["mail_reminder_hours", "questionnaire_reminder_hours"]);
          const hours = (k: string, d: number) => { const v = Number(st?.find((r) => r.key === k)?.value); return v > 0 ? v : d; };
          const now = Date.now();
          const until = (h: number) => new Date(now + h * 3600_000).toISOString();
          const maxH = Math.max(hours("mail_reminder_hours", 24), hours("questionnaire_reminder_hours", 48));
          const { data: appts } = await db.from("appointments").select("id, starts_at, patient_id,treatment_id, treatment:treatments(post_questionnaire_key)")
            .eq("tenant_id", t.id).eq("status", "booked").gt("starts_at", new Date(now).toISOString()).lte("starts_at", until(maxH));
          for (const a of appts ?? []) {
            const left = (Date.parse(a.starts_at) - now) / 3600_000;
            if (left <= hours("mail_reminder_hours", 24) && (await safeQueue(db, a.id, "appointment_reminder", { dedupe: `appointment_reminder-${a.id}` }))) queued++;
            if (left <= hours("questionnaire_reminder_hours", 48)) {
              const preparation=a.patient_id?await appointmentPreparation(t.id,a.patient_id,a.treatment_id,a.starts_at,a.id):null;
              if (preparation?.questionnaireMissing && (await safeQueue(db, a.id, "questionnaire_reminder", { dedupe: `questionnaire_reminder-${a.id}` }))) queued++;
              if (preparation?.detailsMissing && (await safeQueue(db, a.id, "details_reminder", { dedupe: `details_reminder-${a.id}` }))) queued++;
            }
          }
          // Only released consults, on their frozen reminder date; never parked/private notes.
          const notes = await db.from('consult_notes').select('id,appointment_id,step_data,appointment:appointments(starts_at,status)')
            .eq('tenant_id',t.id).eq('status','final').neq('visibility','archived').not('appointment_id','is',null);
          if (notes.error) throw new Error('Behandelherinneringen konden niet worden geladen.');
          for (const note of notes.data ?? []) {
            const appointment = note.appointment;
            if (!note.appointment_id || !appointment || appointment.status !== 'afgerond') continue;
            const days = readStepData(note.step_data).closing.reminderDays;
            if (treatmentReminderDue(appointment.starts_at,days,new Date().toISOString()) &&
              await safeQueue(db,note.appointment_id,'follow_up',{dedupe:`treatment-reminder-${note.id}`})) queued++;
          }
        }
        return Response.json({ success: true, queued });
      },
    },
  },
});
