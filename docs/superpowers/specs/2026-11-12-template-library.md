# Rozsáhlá knihovna šablon OpenCanva

Datum: 12. listopadu 2026. Zadání: po vysvětlení současných 55 šablon uživatel odsouhlasil postup pro tisíce šablon: stránkovaný katalog, import editovatelných návrhů, 40 rozvržení v každé z 10 kategorií se třemi variantami a kontrolu kvality.

## Výsledek pro uživatele

- V galerii bude nejméně 1 200 nových vestavěných šablon vedle dosavadních 55. Každá je návrhem složeným z upravitelných textů, tvarů a případných rámečků na fotku, nikoli plochým obrázkem.
- Hledání podle názvu a štítků bude fungovat i v češtině bez ohledu na diakritiku. Kategorie a počet výsledků zůstanou viditelné. Dashboard i panel návrhu načtou jen jednu stránku výsledků, další na vyžádání.
- Úvodní zobrazení nebude posílat všechna data katalogu do prohlížeče. Stránka načte nejvýše 24 karet a jejich náhledy. Chybějící náhled se může vytvořit v prohlížeči jako dnes, ale dávkový skript musí umět uložit náhledy předem pro celou vestavěnou knihovnu.
- Pro další vlastní balíky bude existovat ověřovaný dávkový import do stejných editovatelných dat. Opakovaný import má stejný výsledek a neodstraní ručně uložené šablony.

## Obsah a rozmanitost

Využijí se stávající kategorie a formáty. Každá kategorie dostane 40 prostorově odlišných rozvržení a tři stylistické podoby. Rozvržení se musí lišit kompozicí, hierarchií a prací s rámečky, ne pouze barvou. Titulky, doprovodné texty a štítky se mají vztahovat k danému typu návrhu. Sada používá lokálně dodávaná písma a vlastní tvary, bez přejímání cizích šablon či stahování cizích aktiv.

Identifikátor vestavěné šablony je deterministický; další seed ji upraví na místě. Stávající šablony a uživatelské návrhy musí zůstat zachované. Importované balíky mají samostatný prefix identifikátorů a při importu se neprovádí mazání ostatních šablon.

## Technické chování

- Nový katalogový dotaz vrací položky, celkový počet, číslo stránky a seznam kategorií. Server může pro ~1 200 kusů seřadit a filtrovat pouze malá metadata; JSON jednotlivých stránek šablon nesmí načítat pro celý katalog.
- Pořadí: ručně uložené šablony od nejnovější, potom vestavěné podle pořadí kategorií a stabilního pořadí v rámci kategorie. Změna hledání nebo kategorie vrací uživatele na první stránku.
- Karty zachovají vytvoření návrhu, použití na otevřené stránce a smazání vlastní šablony. Závažná chyba načtení se zobrazí přímo u galerie.
- Náhledy se ukládají pod stávající `DATA_DIR` a verze URL odpovídá změně obsahu šablony. Dávkový postup může běžet po seeding a pokračovat po přerušení.
- Import odmítne neplatný manifest, duplicity identifikátorů, nepodporované jednotky a neplatná data stránek před zápisem. Při opakování aktualizuje jen změněné položky.

## Ověření

Generátor: počet, jedinečné identifikátory, 10 kategorií, 40 různých geometrií na kategorii, editovatelné objekty a platná data stránek. Katalog: první/další stránka bez překryvu, hledání s diakritikou, stabilní pořadí, prázdný výsledek a zachované akce karet. Import: opakování, chybná data a zachování uživatelských položek. Po nasazení: běžná galerie a editor v Chromiu, zdravé kontejnery a čitelné náhledy vzorku z každé kategorie.
