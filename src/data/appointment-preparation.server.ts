import {admin} from "./booking.server";
import {mergeTemplates,readContent} from "@/domain/dossier-templates";
import {validUntil} from "@/domain/appointment-notifications";
/** Returns completeness only, never medical answers or patient identity. */
export async function appointmentPreparation(tenantId:string,patientId:string,treatmentId:string,at:string){
 const db=await admin();
 const [patient,treatment,links]=await Promise.all([
  db.from("patients").select("email,phone,date_of_birth,postcode,house_number,street,city").eq("tenant_id",tenantId).eq("id",patientId).single(),
  db.from("treatments").select("post_questionnaire_key,dossier_template_override").eq("tenant_id",tenantId).eq("id",treatmentId).single(),
  db.from("treatment_category_links").select("category_id").eq("tenant_id",tenantId).eq("treatment_id",treatmentId)
 ]);
 if(patient.error||treatment.error||links.error)throw new Error("Voorbereiding kon niet worden gecontroleerd.");
 const direct=links.data.map(l=>l.category_id);
 const parents=direct.length?await db.from("treatment_categories").select("parent_id").eq("tenant_id",tenantId).in("id",direct):{data:[]};
 const ids=[...new Set([...direct,...(parents.data??[]).flatMap(p=>p.parent_id?[p.parent_id]:[])])];
 let templates=db.from("dossier_templates").select("id").eq("tenant_id",tenantId);
 templates=treatment.data.dossier_template_override?templates.eq("id",treatment.data.dossier_template_override):templates.in("category_id",ids);
 const selected=await templates;
 const versions=selected.data?.length?await db.from("dossier_template_versions").select("content").eq("tenant_id",tenantId).in("template_id",selected.data.map(t=>t.id)).eq("status","live"):{data:[]};
 const template=mergeTemplates((versions.data??[]).map(v=>readContent(v.content)));
 const key=treatment.data.post_questionnaire_key??template.questionnaire.key;
 const answers=key?await db.from("answer_sets").select("completed_at").eq("tenant_id",tenantId).eq("patient_id",patientId).eq("questionnaire_key",key).eq("status","completed").lte("completed_at",at).order("completed_at",{ascending:false}).limit(1):{data:[]};
 const questionnaireMissing=!!key&&!validUntil(answers.data?.[0]?.completed_at??null,template.questionnaire.reaskDays,at);
 const p=patient.data;
 return {detailsMissing:![p.email,p.phone,p.date_of_birth,p.postcode,p.house_number,p.street,p.city].every(Boolean),questionnaireMissing,questionnaireRequired:!!key,consentRequired:template.consentForms.length>0};
}