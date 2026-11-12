"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IMAGE_ASPECTS, TEXT_ACTION_LABELS, type AiStatus, type ImageAspect, type TextAction } from "@/lib/ai";
import { editSelectedImage, fetchAiStatus, generateAndPlace, rewriteSelectedText, writeText, type ImageEdit } from "@/lib/canvas/ai";
import { useEditorStore } from "@/lib/store/editor";
import { EraseDialog } from "./erase-dialog";

const REWRITES: TextAction[] = ["shorter", "longer", "formal", "spelling"];
const ASPECT_LABELS: Record<ImageAspect, string> = { square: "Čtverec", landscape: "Na šířku", portrait: "Na výšku" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** Writing, rewriting and image generation and editing through the configured AI providers. */
export function AiPanel() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState("angličtina");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<ImageAspect>("square");
  const [editPrompt, setEditPrompt] = useState("");
  const [erasing, setErasing] = useState(false);
  const selection = useEditorStore((s) => s.selection);
  const textSelected = selection?.count === 1 && selection.kind === "text" && !selection.locked;
  const pictureSelected = selection?.count === 1 && selection.kind === "image" && !selection.locked && !selection.image?.video && !selection.image?.qr;

  useEffect(() => {
    fetchAiStatus().then(setStatus, () => setStatus({ text: false, image: false, textProvider: null, imageProvider: null }));
  }, []);

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "To se nepovedlo.");
    } finally {
      setBusy(null);
    }
  }

  if (!status) return <p className="p-3 text-xs text-muted-foreground">Ověřuji nástroje AI…</p>;
  const spinner = (key: string) => busy === key && <Loader2 className="animate-spin" />;

  return (
    <div className="grid gap-5 p-3">
      <p className="rounded-md border bg-muted/40 p-2.5 text-[11px] text-muted-foreground" role="note">
        Zadání, přepisované texty a upravované obrázky se odesílají {status.textProvider || status.imageProvider ? "poskytovateli AI nastavenému na serveru" : "poskytovateli AI"}
        {status.textProvider ? ` (text: ${status.textProvider}` : ""}
        {status.textProvider && status.imageProvider ? `; obrázky: ${status.imageProvider})` : status.textProvider ? ")" : status.imageProvider ? ` (obrázky: ${status.imageProvider})` : ""}. Nic dalšího
        z vašich návrhů se neodesílá.
      </p>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <Section title="Text">
        {status.text ? (
          <>
            {textSelected ? (
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {REWRITES.map((action) => (
                    <Button key={action} variant="outline" size="sm" disabled={busy !== null} onClick={() => void run(action, () => rewriteSelectedText(action))}>
                      {spinner(action)}
                      {TEXT_ACTION_LABELS[action]}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input aria-label="Přeložit do jazyka" value={language} onChange={(e) => setLanguage(e.target.value)} className="h-8" />
                  <Button variant="outline" size="sm" disabled={busy !== null || !language.trim()} onClick={() => void run("translate", () => rewriteSelectedText("translate", language))}>
                    {spinner("translate")}
                    Přeložit
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Vyberte na stránce text, který chcete přepsat nebo přeložit.</p>
            )}
            <textarea
              aria-label="Zadání textu"
              placeholder="Popište text, který se má napsat, např. slogan pro letní výprodej"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={2}
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ring dark:bg-input/30"
            />
            <Button size="sm" disabled={busy !== null || !brief.trim()} onClick={() => void run("write", () => writeText(brief.trim()))}>
              {spinner("write")}
              Napsat text
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground" role="status">
            Není nastaveno. Nastavte <code className="font-mono">ANTHROPIC_API_KEY</code> v prostředí serveru (soubor <code className="font-mono">.env</code>) a restartujte aplikaci.
          </p>
        )}
      </Section>

      <Section title="Obrázky">
        {status.image ? (
          <>
            <textarea
              aria-label="Zadání obrázku"
              placeholder="Popište obrázek, který se má vytvořit"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ring dark:bg-input/30"
            />
            <div className="flex gap-1.5">
              <select
                aria-label="Tvar obrázku"
                value={aspect}
                onChange={(e) => setAspect(e.target.value as ImageAspect)}
                className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              >
                {IMAGE_ASPECTS.map((a) => (
                  <option key={a} value={a}>
                    {ASPECT_LABELS[a]}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={busy !== null || !prompt.trim()} onClick={() => void run("generate", () => generateAndPlace(prompt.trim(), aspect))}>
                {spinner("generate")}
                Vygenerovat
              </Button>
            </div>
            {pictureSelected ? (
              <div className="grid gap-1.5 rounded-md border p-2">
                <span className="text-xs text-muted-foreground">Vybraný obrázek</span>
                <Input aria-label="Zadání úpravy" placeholder="Co tam má být (nepovinné)" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} className="h-8" />
                <div className="grid grid-cols-3 gap-1.5">
                  {(["background", "expand"] as ImageEdit[]).map((kind) => (
                    <Button key={kind} variant="outline" size="sm" disabled={busy !== null} onClick={() => void run(kind, () => editSelectedImage(kind, editPrompt))}>
                      {spinner(kind)}
                      {kind === "background" ? "Pozadí" : "Rozšířit"}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => setErasing(true)}>
                    {spinner("erase")}
                    Vymazat…
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Vyberte obrázek, kterému chcete nahradit pozadí, rozšířit ho nebo z něj něco vymazat.</p>
            )}
            <EraseDialog
              open={erasing}
              onOpenChange={setErasing}
              onErase={(mask) => {
                setErasing(false);
                void run("erase", () => editSelectedImage("erase", editPrompt, mask));
              }}
            />
          </>
        ) : (
          <p className="text-xs text-muted-foreground" role="status">
            Není nastaveno. Nastavte <code className="font-mono">OPENAI_API_KEY</code> (obrázkové API kompatibilní s OpenAI; pro jiné <code className="font-mono">OPENAI_BASE_URL</code>) v prostředí serveru a restartujte aplikaci.
          </p>
        )}
      </Section>
    </div>
  );
}
