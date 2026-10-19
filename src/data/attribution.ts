import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export const attributionQuery=queryOptions({queryKey:["booking-attribution"],queryFn:async()=>{
  const [channels,places,campaigns]=await Promise.all([supabase.from("booking_channels").select("*").order("sort"),supabase.from("booking_places").select("*").order("sort"),supabase.from("booking_campaigns").select("*").order("created_at")]);
  for(const result of [channels,places,campaigns]) if(result.error) throw new Error("Kanalen laden is niet gelukt");
  return {channels:channels.data??[],places:places.data??[],campaigns:campaigns.data??[]};
}});