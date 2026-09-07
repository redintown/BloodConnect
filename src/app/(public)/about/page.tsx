import { PageShell } from "@/components/ui/PageShell";
import { siteConfig } from "@/config/site";

export default function AboutPage() {
  return (
    <PageShell title="About">
      <p className="text-gray-600">{siteConfig.description}</p>
    </PageShell>
  );
}
