# MISSION: Massive Content, Presets & Dashboard UI Expansion (Canva Pro Clone)

Implement the exact dashboard navigation from the screenshots, populate a massive library of design presets, expand the font and vector elements library, and implement an automated template generation engine.

---

## 1. DASHBOARD UI ARCHITECTURE (Matches Screenshots)

Implement/Update the dashboard layout to feature the exact two-tier navigation structure:

### A. Horizontal Main Category Bar (`components/dashboard/CategoryNavbar.tsx`):
Replicate the top horizontal scrollable category pills/buttons with gradient icons:
- `Šablony` (Template overview / All)
- `Prezentace` (16:9, 4:3, Vzdělávání, Pitch deck)
- `Sociální sítě` (Instagram, Facebook, LinkedIn, TikTok, YouTube, Pinterest, X, WhatsApp)
- `Video` (Reels, TikTok, YouTube, Shorts)
- `Tisk` (A4, A5, Vizitky, Letáky, Plakáty A2/A3, Trička)
- `Dokument` (A4 dokument, Souhrnná zpráva, Faktura, Životopis)
- `Whiteboard` (Nekonečné plátno, Myšlenková mapa, Brainstorming)
- `Tabulka` / `Listy` (Plánovače, Rozpočty, Matice)
- `Kód` (Syntax-highlighted card generator, Tech snippets)
- `Web` (Webové bannery, Hero sekce, E-shop záhlaví)
- `E-mail` (E-mail newsletter záhlaví, Podpisy)
- `Fotografie` (Úpravy fotek, Koláže, Portrét, Tapety)
- `Zázračné vrstvy` (AI & Multi-layer composites)
- `Vlastní velikost` (Modal with Width, Height, Units: px/mm/cm/in)
- `Nahrát` (Direct drag & drop file to edit)

### B. Vertical Left Sidebar Drawer (`components/dashboard/DashboardSidebar.tsx`):
Implement the vertical category list matching Screenshot 2:
- Items: `Pro vás`, `Vzdělávání`, `Prezentace`, `Sociální sítě`, `Fotografie`, `Videa`, `Tisk`, `Docs`, `Tabule`, `Listy`, `Kód`, `Weby`, `E-maily`, `Vlastní velikost`, `Nahrát`.
- Active state: Dark purple capsule background (`#4f46e5` or `#3b2d6d`), glowing accent.

### C. Subcategory Filter Pills (`components/dashboard/SubcategoryPills.tsx`):
When "Sociální sítě" is active, display the horizontal platform pill filter (Screenshot 4):
- `Populární` (Vše)
- `Facebook` (Příspěvek na šířku 1200x630, Čtverec 1080x1080, Příběh 1080x1920, Titulní fotka 820x312, Událost 1920x1080)
- `Instagram` (Příspěvek čtverec 1080x1080, Portrét 1080x1350, Příběh/Reels 1080x1920, Carousel)
- `LinkedIn` (Příspěvek 1200x627, Banner profilu 1584x396, Firemní logo/příspěvek 1200x1200)
- `Pinterest` (Standardní pin 1000x1500, Dlouhý pin 1000x2100)
- `TikTok` (Video/Příběh 1080x1920)
- `Twitter / X` (Příspěvek 1600x900, Záhlaví 1500x500)
- `WhatsApp` (Stav 1080x1920, Profilový obrázek 500x500)
- `YouTube` (Miniatura/Thumbnail 1280x720, Banner kanálu 2560x1440)

### D. Format Grid Cards (`components/dashboard/FormatGrid.tsx`):
Implement cards matching Screenshot 3:
- Rounded corners (`rounded-2xl`), subtle dark surface background (`bg-[#18191b] hover:bg-[#25262b]`).
- Stylized 3D / vivid gradient graphic preview in the center.
- Label beneath the card with dimension label (e.g. "Pracovní list (A4, na výšku)", "Miniatura YouTube (1280 × 720 px)").
- Clicking any card creates a new Canvas project pre-sized to those exact dimensions.

---

## 2. PRESET DIMENSIONS MATRIX (`constants/presets.ts`)

Create a comprehensive configuration file exporting all design dimensions:

```typescript
export interface DesignPreset {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  width: number;
  height: number;
  unit: 'px' | 'mm';
  icon: string;
  badge?: string;
}
Include at least 40 presets covering:
Instagram: Square (1080x1080), Portrait (1080x1350), Story/Reels (1080x1920).
Facebook: Feed Post (1200x630), Story (1080x1920), Cover Photo (820x312), Group Cover (1640x856).
YouTube: Thumbnail (1280x720), Channel Banner (2560x1440).
TikTok: Video (1080x1920), Profile (500x500).
LinkedIn: Post (1200x627), Cover Banner (1584x396).
Twitter/X: Post (1600x900), Header (1500x500).
Pinterest: Standard Pin (1000x1500).
Print: A4 Portrait (2480x3508 px @ 300DPI), A4 Landscape, A5, Business Card (1050x600 px), Poster A2 (4960x7016 px), Flyer (1275x1875 px).
Education (Vzdělávání): Pracovní list A4, Kartička (Flashcard), Rozvrh hodin, Třídní zpravodaj, Infografika, Záhlaví Google Classroom (1000x250).
Presentations: Standard 16:9 (1920x1080), 4:3 (1024x768).
3. MASSIVE TEMPLATE GENERATION & SEEDER (lib/templates/seeder.ts)
Instead of just 2-3 basic templates, build a robust template generator script that populates the database/storage with at least 50+ rich Fabric.js JSON templates:
A. Template JSON Schema:
Each template must contain:
Canvas background (Gradient or rich dark/light solid).
Layered shapes, badges, stickers, and decorative lines.
Styled typography (Headline, Subtitle, CTA Button, Tagline) with proper fonts, line heights, and shadow effects.
Image placeholders (using Unsplash source URLs with reliable categories: business, tech, abstract, nature, portrait).
B. Categories to generate templates for:
Instagram Post & Story:
E-commerce / Sale 50% Off (Bold typography, discount badges, gradient frames).
Podcast Episode Promo (Waveform graphics, speaker placeholder, play button).
Inspirational Quotes (Clean serif typography, subtle quotes icons, elegant background).
Real Estate / Property Showcase (Grid layout, modern badges, price tags).
Fitness / Health Tips (High contrast, checklist bullets, neon accents).
YouTube Thumbnails:
Gaming / Reaction (Stroked bold text, explosive background burst, high contrast).
Tech / Coding Tutorial (VS Code mockups, minimal clean layout, glowing accents).
Finance / Investing (Charts, green/red badges, bold numbers).
LinkedIn & Business:
Webinar / Event Announcement (Date badges, speaker cards, minimal enterprise theme).
Hiring / We Are Hiring (Clean corporate layout, benefit list, badge).
Vzdělávání (Education):
Rozvrh hodin (Weekly timetable grid, pastel colors, subject blocks).
Pracovní list A4 (Header, name/date fields, numbered question blocks).
Myšlenková mapa / Mind Map (Central hub with 5 connected nodes and arrows).
Prezentace (Pitch Deck):
Title Slide, Problem/Solution Slide, Team Slide, Pricing Matrix Slide.
4. EXPANDED FONT LIBRARY (constants/fonts.ts)
Integrate Google Fonts dynamically. Every font must support Latin-Extended diacritics (č, š, ž, ř, ď, ť, ň, ú, ů, á, é, í, ó, ý).
Group into 5 categories with at least 8-10 fonts each (Total 45+ fonts):
Modern Sans-Serif: Inter, Montserrat, Poppins, Plus Jakarta Sans, Outfit, Raleway, Work Sans, DM Sans.
Editorial Serif: Playfair Display, Merriweather, Lora, Cinzel, Cormorant Garamond, DM Serif Display, Bodoni Moda.
Bold / Display: Bebas Neue, Oswald, Anton, Syne, Archivo Black, Russo One, Righteous.
Handwriting / Script: Caveat, Dancing Script, Pacifico, Great Vibes, Kalam, Satisfy.
Monospace / Tech: JetBrains Mono, Fira Code, Space Mono.
Implementation:
Load fonts on-demand via Web Font Loader or by injecting <link> tags dynamically when selected or previewed in the font dropdown.
Provide a font preview picker with rendered previews for each font family.
5. VECTOR ELEMENTS, SHAPES & FRAMES LIBRARY (constants/elements.ts)
Provide a comprehensive collection of pre-made vector shapes and elements for the Canvas sidebar:
Basic Geometric Shapes: Rectangle, Rounded Rectangle, Circle, Ellipse, Triangle, Polygon (Hexagon, Octagon), Star (4, 5, 8, 12 points), Heart, Speech Bubble.
Arrows & Lines: Solid line, Dashed line, Dotted line, Arrow right, Double arrow, Curved arrow, Zigzag line.
Decorative Badges & Ribbons: 20% OFF starburst, Sale ribbon, Verified badge checkmark, Price tag.
Frames & Masks (Clipping paths): Circular photo frame, Phone mockup frame, Laptop frame, Torn paper mask, Postage stamp frame.
Social Media Icons: SVGs for Instagram, Facebook, TikTok, YouTube, LinkedIn, X, WhatsApp, Pinterest, Mail, Globe, Phone.
Abstract Blobs & Gradients: 10 SVG organic blob shapes for modern background compositions.
6. EXECUTION INSTRUCTIONS FOR CLAUDE CODE
Create the data models and constants:
Create constants/presets.ts with all 40+ dimension presets.
Create constants/fonts.ts with all 45+ Google fonts and dynamic loader helper.
Create constants/elements.ts with inline SVG strings and Fabric.js path definitions.
Build Dashboard UI components:
Update app/page.tsx to display the category navigation matching screenshots 1, 2, 3, and 4.
Wire clicking on any format card to launch /editor?preset=[id] which initializes the canvas with exact dimensions.
Execute Template Seeder:
Create and run scripts/generate-templates.ts (or seed script) to output at least 50 varied template JSON objects categorized by platform.
Ensure these appear in the Editor's left sidebar under "Templates" with instant 1-click loading onto the canvas.
Verify:
Ensure all Czech labels and diacritics render perfectly.
Run typecheck (tsc --noEmit) to guarantee zero TypeScript errors.
Begin generating these files immediately.