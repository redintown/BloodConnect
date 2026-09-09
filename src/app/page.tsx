import Link from "next/link";
import { EmergencyButton } from "@/components/ui/EmergencyButton";
import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-form flex-col justify-between gap-8 p-6 outline-none"
    >
      <div className="flex flex-col gap-2 pt-10">
        <h1 className="text-2xl font-bold">{siteConfig.name}</h1>
        <p className="text-gray-600">{siteConfig.description}</p>
      </div>

      <div className="flex flex-col gap-3">
        <EmergencyButton />
        <Link
          href="/find-blood"
          className="flex w-full items-center justify-center rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Find blood
        </Link>
        <Link
          href="/donor"
          className="flex w-full items-center justify-center rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          I want to donate
        </Link>
      </div>

      <nav className="flex justify-center gap-4 pb-4 text-sm text-gray-400">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/about">About</Link>
      </nav>
    </main>
  );
}
