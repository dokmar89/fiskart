Pracuješ v repozitáři FiskART – self-hosted alternativy ke Canvě, která běží lokálně na
http://localhost:3000. Používá ji jediný člověk. Rozhraní je česky a česky zůstane.

CÍL
Doplnit funkce a obsah, ve kterých FiskART zaostává za Canvou. Knihovna obsahu má stejnou
prioritu jako funkce editoru.

MIMO ROZSAH (nedělej)
Účty, přihlašování, sdílení, komentáře, spolupráce v reálném čase, týmy, oprávnění, třídy
a zadávání úkolů, objednávání tisku, mobilní aplikace.

KROK 0 – AUDIT (než cokoli napíšeš)
1. Projdi repozitář: stack, datový model, formát návrhu a šablony, jak se registrují prvky,
   panely a exporty, jak se načítají fotky a ikony, jak fungují testy.
2. U každé položky ze seznamu níže zjisti stav: hotovo / částečně / chybí. Nic nepředpokládej,
   ověř v kódu a v běžící aplikaci.
3. Zapiš výsledek do docs/GAP-AUDIT.md a navrhni pořadí fází. Pak pokračuj bez čekání,
   pokud nenarazíš na rozhodnutí, které mění datový model nevratně.

CO DOPLNIT

A) Knihovna obsahu
- Šablony: aspoň 600 unikátních rozvržení (barevná varianta se nepočítá jako nová šablona),
  rovnoměrně přes všechny formáty na domovské stránce. Každá musí být plně editovatelná,
  s českými texty a s náhledem. Přidej štítky a fulltextové hledání.
- Ilustrace, samolepky, animované prvky (Lottie), mockupy zařízení, další rámečky a tvary.
- Fotky: další zdroje vedle Pexels, jednotné hledání přes všechny zdroje.
- Stock video a zvuk (hudba, efekty) včetně hledání a náhledu.
- Písma: široký výběr s náhledem, hledáním a podporou české diakritiky.
- U každého zdroje ověř licenci a podmínky API. Použij jen zdroje, které dovolují
  self-hosted použití; licenci a povinnou atribuci ulož ke každému assetu a vypiš je
  v docs/LICENSES-CONTENT.md. Klíče jen přes .env, doplň .env.example.
- Použitý asset se zkopíruje lokálně, aby návrh fungoval i offline.

B) Úpravy fotek
Ořez, otočení, překlopení, filtry, úpravy (jas, kontrast, sytost, teplota, rozostření),
odstranění pozadí, mazání objektů, rozšíření obrázku, stíny, průhlednost.

C) Video a zvuk
Časová osa, střih a ořez klipů, více stop, zvuková stopa s hlasitostí a náběhy,
titulky, export MP4 se zvukem.

D) AI
- Aplikace musí jít spustit a používat i bez klíčů; AI funkce se pak skryjí nebo vypnou
  se srozumitelnou hláškou.
- S klíči: vygenerování celého návrhu z promptu, přepis a překlad textu, generování
  a úprava obrázků, automatická změna velikosti s přeskládáním rozvržení.

E) Organizace návrhů
Složky, hledání ve vlastních návrzích, řazení, oblíbené, koš s obnovením, duplikace,
historie verzí s návratem.

F) Výstup
PPTX, tiskové PDF (spadávky, ořezové značky, volba barevného profilu), export vybraných
stránek, hromadný export, import PPTX a PDF, pokud to formát dovolí.

G) Ostatní typy dokumentů
Dokument, Whiteboard, Tabulka, Kód, Web, E-mail a Zázračné vrstvy: ověř, jestli jsou to
skutečné editory, nebo jen formát plátna. Co je jen formát, dotáhni na použitelný editor.
Prezentace: poznámky řečníka, pohled řečníka, časovač.

H) Hromadná tvorba
Naplnění šablony daty z CSV a vygenerování sady návrhů.

PRAVIDLA PRÁCE
- Pracuj po fázích, každá fáze = samostatná větev a commity s popisem. Po každé fázi musí
  aplikace běžet a existující návrhy se musí otevřít beze změny.
- Změny datového modelu jen přes migrace, se zálohou dat před spuštěním.
- Drž se existujících konvencí kódu, komponent a vzhledu. Nepřepisuj, co funguje.
- Ke každé funkci napiš testy a ověř ji v běžící aplikaci, ne jen kompilací.
- Nic neposílej ven kromě volání API zdrojů obsahu a AI poskytovatelů z bodů A a D.
- Když něco nejde udělat poctivě (licence, chybějící API, výkon), nezakrývej to maketou.
  Zapiš to do docs/GAP-AUDIT.md jako nevyřešené s důvodem.

VÝSTUP PO KAŽDÉ FÁZI
Aktualizuj docs/GAP-AUDIT.md: co je hotovo, co je ověřeno a jak, co zbývá, známé chyby.
Na konci napiš souhrn: počty šablon a assetů podle typu, seznam zdrojů s licencemi,
seznam nových proměnných v .env a co zůstalo nedodělané.