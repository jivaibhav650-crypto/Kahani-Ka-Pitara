# Kahani Ka Pitara — Cloudflare Native Final

यह build Supabase को runtime पर इस्तेमाल नहीं करता। Backend Cloudflare Pages Functions + D1 + R2 पर है।

## एक बार का Cloudflare setup
1. Cloudflare में D1 database बनाएं: `kahanikapitara-db` और `schema.sql` run करें।
2. R2 bucket बनाएं: `kahanikapitara-media`।
3. Pages project में D1 binding `DB` और R2 binding `MEDIA` जोड़ें।
4. `BOOTSTRAP_ADMIN_EMAIL` को अपने email पर सेट करें। पहली बार signup करने वाला user admin बनता है; इसलिए deployment के तुरंत बाद अपना account बनाएं।
5. Functions वाला build deploy करें। Dashboard drag/drop में bindings/functions उपलब्ध न हों तो Wrangler से deploy करें: `npx wrangler pages deploy . --project-name kahanikapitara` (bindings `wrangler.toml` में भरें)।

## Existing Supabase data
Deploy के बाद Profile से अपना admin account बनाकर `/migrate.html` खोलें। पुराने Supabase URL और publishable/anon key डालकर एक बार Stories और News/Blog import करें। Passwords migrate नहीं किए जा सकते; users को Cloudflare auth में दोबारा signup करना होगा।

## Important
- Existing Supabase को तब तक delete मत करें जब तक migration और site testing पूरी न हो।
- यह build Supabase SDK/URL को runtime में नहीं बुलाता। `migrate.html` केवल one-time import के लिए पुराने Supabase REST API को इस्तेमाल करता है।
- Images/videos R2 में जाते हैं। Max upload 100 MB per file है।
- Public site में Admin link नहीं है; `/admin.html` direct URL से खुलता है और admin role मांगता है।
- Analytics Cloudflare backend में page views और story views रखता है; dashboard में basic counts दिखते हैं।

## Fixed build
Admin page now includes direct first-time signup. If the D1 stories table is empty, the API automatically seeds six starter stories on first public request. This is only a fallback; existing stories are never deleted.


## Master upgrade included
- Existing Cloudflare Pages + D1 architecture preserved.
- Existing private user-to-user chat endpoints and UI preserved.
- Bilingual Hindi/Roman-English search aliases expanded.
- Story seeding grows the catalog up to 50 stories without deleting existing rows.
- News/Blog seeding grows the catalog up to 50 posts without deleting existing rows.
- The supplied JSZip browser wrapper is a ZIP-builder utility, so it was not injected into production pages; its useful backend/data concepts were merged safely into the existing project.
