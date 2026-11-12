import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold">Nenalezeno</h1>
      <p className="text-sm text-muted-foreground">Tato stránka nebo návrh neexistuje.</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Zpět na přehled
      </Link>
    </main>
  );
}
