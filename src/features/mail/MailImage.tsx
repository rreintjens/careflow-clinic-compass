import { useQuery } from "@tanstack/react-query";
import { mailImageUrlQuery } from "@/data/mail-images";

export function MailImage({ path, alt = "", className }: { path: string; alt?: string; className?: string }) {
  const query = useQuery(mailImageUrlQuery(path));
  return query.data ? <img src={query.data} alt={alt} className={className} /> : <div aria-busy={query.isPending} className={`bg-mist ${className ?? ""}`} />;
}