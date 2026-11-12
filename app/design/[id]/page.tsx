import { notFound } from "next/navigation";
import { EditorLoader } from "@/components/editor/editor-loader";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      width: true,
      height: true,
      unit: true,
    },
  });
  if (!project) notFound();

  return <EditorLoader project={project} />;
}
