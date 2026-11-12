# FiskART: stav projektu a cesta k plnohodnotné aplikaci

Datum revize: 13. listopadu 2026. Podklad: celý `PLAN.md` (fáze 0–21), `SPECIAL_MISSION.md`, `EXTRA.md`, zdrojový kód a provedené kontroly. Zaškrtnutí v plánu znamená, že byla daná fáze implementována; samo o sobě nedokládá připravenost pro veřejný provoz.

## Co už aplikace umí

| Fáze | Obsah poznámek v `PLAN.md` | Stav |
| --- | --- | --- |
| 0 | Next.js, databáze, Docker, základ projektu. | Hotovo podle plánu. |
| 1 | Editor plátna, objekty, výběr a manipulace. | Hotovo podle plánu. |
| 2 | Projekty, ukládání, historie a undo/redo. | Hotovo; některé operace se stránkami nemají undo. |
| 3 | Nahrávání obrázků, vrstvy a práce s fotografiemi. | Hotovo; chybějící obrázky při exportu vyžadují jasnější hlášení. |
| 4 | Kontextová lišta, zarovnání, vodítka a přichytávání. | Hotovo. |
| 5 | Vícestránkové návrhy, náhledy a PNG/JPEG/PDF/SVG export. | Hotovo; některé okrajové případy SVG a práce se stránkami čekají na kontrolu. |
| 6 | Písma a textové efekty. | Hotovo; 70 lokálně dodávaných rodin s českými znaky, rozšířené textové efekty a kombinace. |
| 7 | Katalog šablon, načítání a ukládání vlastní šablony. | Hotovo; katalog nyní obsahuje 1 255 vestavěných šablon, stránkování a vyhledávání. |
| 8 | Brand kit: barvy, loga, použití v návrhu. | Základ hotov; bez automatické kontroly kontrastu a výchozích rolí písem. |
| 9 | Změna velikosti návrhu. | Hotovo v editoru; výběr pouze části stránek chybí. |
| 10 | Úpravy obrázků, ořez, rámy, odstranění pozadí. | Rozšířeno o stupně barev, vinětaci, obrys nálepky a 39 rámečků; práce s obrázkem v rámu potřebuje další ergonomii. |
| 11 | Fotografie Pexels a grafika Iconify. | Rozšířeno o živé hledání a kategorie Iconify; chybí videa Pexels a úplná správa licencí ikon. |
| 12 | Kreslení, vodítka, zakřivený text a režim prezentace. | Rozšířeno o čtyři štětce a stupňové zakřivení textu. |
| 13 | Nasazení v Docker Compose, migrace a záloha. | Funguje lokálně; obraz je velký a nebylo ověřeno nasazení na samostatném stroji. |
| 14 | Přesné úpravy, spojnice, tabulky, QR a hledání/náhrada. | Čtyři styly tabulek; stále chybí sloučené buňky a bohatý text, spojnice mají okrajové případy. |
| 15 | Grafy, mřížky a knihovna grafiky. | Osm typů grafů a 25 mřížek; stále chybí popisky os a individuální barvy některých dat. |
| 16 | Animace objektů, stránek a přechody. | Nové vstupy a smyčky s náhledy; wipe u zaoblených/rámovaných obrázků a autoplay celé prezentace zbývají. |
| 17 | MP4/WebM na stránce, střih, zvuk a synchronizace v náhledu. | Hotovo; přehrávání přímo na editačním plátně a poster z počátku střihu chybí. |
| 18 | Export MP4/WebM/GIF se zvukem, průběhem a zrušením. | Ověřeno v Chromiu; přehrávače a prohlížeče mimo Chromium čekají na kontrolu. |
| 19 | AI text, tvorba a úpravy obrázků přes serverové providery. | Hotovo pro dvě rodiny providerů; reálné účty/klíče nebyly při testech volány. |
| 20 | Tmavý dashboard, formáty, písma, lokální grafika a šablony podle snímku. | Hotovo; 65 formátů, 70 písem, 130 prvků a původních 55 šablon, později rozšířených na 1 255. |
| 21 | Rozšíření `EXTRA.md`: Iconify, animace, typografie, rámečky, úpravy fotek, kreslení, grafy a tabulky. | Implementováno; hlavní toky ověřeny v Chromiu. |

`SPECIAL_MISSION.md` přidala tmavý dashboard podle dodaného snímku, 65 formátů, přímé nahrání obrázku do nového návrhu, rozšířený výběr písem, 130 lokálních grafických prvků a 40 nových variací šablon. Tiskové formáty jsou uloženy v reálných rozměrech a při exportu se převádějí na požadované DPI. Náhledy a tvorba návrhů používají stávající datový model a trasu editoru `/design/[id]`.

`EXTRA.md` rozšířila editor o vyhledávání Iconify, 25 mřížek fotek, 39 rámečků, osm typů grafů, čtyři styly tabulek a čtyři kreslicí štětce. Přibyly animace, textové kombinace a efekty, obrazové filtry a obrys nálepky. Vložené ikony se ukládají lokálně; nové objekty používají dosavadní historii, ukládání a export.

Knihovna šablon nyní přidává 1 200 upravitelných kompozic v 10 kategoriích k původním 55. Katalog načítá 24 karet na stránku, podporuje vyhledávání a přidávání dalších balíků přes validovaný JSON import. Náhledy se dají předpočítat a uložit. Jde o programově generované výchozí kompozice; obsahová revize a ručně tvořené prémiové šablony zůstávají další prací.

## Co dodělat pro plnohodnotné používání

### P0: před zpřístupněním dalším lidem

1. **Přihlášení a oprávnění.** Aplikace je dnes jedno­uživatelská bez loginu. Kdokoli s přístupem na server může vidět a měnit všechna data. Pro sdílené nebo veřejné použití je potřeba autentizace, oddělení dat uživatelů, kontrola přístupu ke všem API a bezpečné sdílení.
2. **Záloha a obnova na skutečném nasazení.** Popsaný postup zálohuje databázi i soubory. Je potřeba ho pravidelně spouštět a alespoň jednou obnovit na jiném stroji, včetně otestování upgradu a návratu po neúspěšné migraci.
3. **Spolehlivé ukládání a chybové stavy.** Domovská navigace podle poznámek čeká jen na uložení otevřené stránky; selhání uložení jiné stránky se může přehlédnout. U exportu chybějících souborů má uživatel vidět konkrétní chybu. Přidat upozornění na neuložené změny a obnovu po výpadku.
4. **Právní a provozní kontrola závislostí.** Knihovna pro odstranění pozadí je AGPL. U externích ikon se liší licence a některé vyžadují uvedení autora; před veřejnou službou je nutné zvolit kompatibilní řešení a sledovat použitá aktiva.

### P1: kvalitní každodenní práce

1. **Editor pro menší displeje a přístupnost.** Editor předpokládá šířku alespoň 1024 px. Doplnit responzivní rozvržení, ovládání klávesnicí, čtečky obrazovky, viditelné focus stavy a kontrolu kontrastu; zkoušet skutečné zařízení, ne pouze zúžené okno.
2. **Stránky a historie.** Doplnit undo pro přidání, smazání a přesun stránky, názvy stránek a jejich přerovnání klávesnicí. Vyjasnit, zda resize mění celý dokument nebo vybrané stránky.
3. **Velké soubory a paměť.** Náhledy obrázků vytvářet z menších variant a při nahrávání velkých souborů omezit spotřebu paměti. Změřit několik návrhů se stovkami objektů a dlouhým videem. Docker obraz zmenšit.
4. **Export napříč prohlížeči.** Ověřit SVG (ořezané/zaoblené obrázky a text s prostrkáním), PDF a video/GIF ve Firefoxu, Edge a běžných přehrávačích. Přidat kontrolu výsledku po exportu, ne jen úspěšného stažení.
5. **Dotažení editorových funkcí.** Práce s obrázkem v rámu, kontrast a typografické role Brand kitu, sloučené buňky a bohatý text v tabulkách, přesnější spojnice a popisky os grafů, přehrávání videa na plátně a autoplay prezentace.

### P2: rozšíření podle potřeby produktu

- Spolupráce více lidí, komentáře, verzování, role a sdílení; současná architektura je určena pro jednoho uživatele.
- Transparentní/volitelné pozadí stránky, přesnější typografické a tiskové kontroly, případně tiskové spadávky a barevné profily.
- Katalog obsahu s vyhledáváním, štítky, filtrem licencí a správou zdrojů; větší sada lokálních šablon vyžaduje průběžnou obsahovou revizi.
- U AI více výsledků k výběru, úpravy podle textového zadání a případně další poskytovatelé. Je potřeba rozpočet, limity a pravidla pro odesílání dat.

## Ověření a známá omezení

Plán uvádí průběžné unit a E2E testy. V pozdějších fázích se celý E2E běh při třech paralelních workerech občas zadrhl, zatímco cílené běhy procházely. Pro spolehlivou CI je potřeba testy rozdělit, sledovat časové limity a spouštět kritickou sadu sériově. Fáze 21 prošla typovou kontrolou, lintem, produkčním sestavením, 356 jednotkovými testy a sadou 29 prohlížečových scénářů v Chromiu; rámečky zařízení a SVG nálepky prošly ještě samostatným cíleným během. Rozšíření katalogu následně prošlo 378 jednotkovými testy, lintem, typovou kontrolou, produkčním sestavením a cílenými scénáři v Chromiu. Nové obrazové efekty vyžadují výkonové měření na velkých souborech.

Pořadí výše je doporučení z revize kódu a poznámek, nikoli tvrzení, že všechny položky jsou chybami dnešní lokální instalace. Pro soukromé používání na vlastním počítači už aplikace pokrývá velkou část běžných tvůrčích úloh.
