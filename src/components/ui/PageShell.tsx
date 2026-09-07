/**
 * Consistent shell for skeleton-phase pages: a title, optional subtitle,
 * and a note about which phase implements the real content. Real pages
 * replace their body with actual UI as each phase lands — the shell keeps
 * the visual rhythm (spacing, heading style) consistent while that happens.
 */
export function PageShell({
  title,
  phaseNote,
  children,
}: {
  title: string;
  phaseNote?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">{title}</h1>
      {children}
      {phaseNote && <p className="mt-auto pb-4 text-xs text-gray-400">{phaseNote}</p>}
    </main>
  );
}
