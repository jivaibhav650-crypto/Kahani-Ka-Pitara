const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extra
    }
  });

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

function text(v) {
  return String(v ?? "").trim();
}

async function sha256(s) {
  const b = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s)
  );
  return [...new Uint8Array(b)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}

function b64(bytes) {
  let s = "";
  bytes.forEach(x => s += String.fromCharCode(x));
  return btoa(s)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function unb64(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function passwordHash(
  password,
  salt = b64(crypto.getRandomValues(new Uint8Array(16)))
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: unb64(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    key,
    256
  );

  return `${salt}.${b64(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(".")) return false;
  const [salt] = stored.split(".");
  const h = await passwordHash(password, salt);
  return h === stored;
}

function cookie(token) {
  return `kkp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

function clearCookie() {
  return "kkp_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

async function currentUser(req, env) {
  const m = req.headers.get("cookie") || "";
  const token =
    (m.match(/(?:^|; )kkp_session=([^;]+)/) || [])[1];

  if (!token) return null;

  const th = await sha256(token);

  const r = await env.DB.prepare(
    `SELECT u.id,u.email,u.name,u.role
     FROM sessions s
     JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at>?`
  )
    .bind(th, Date.now())
    .first();

  return r || null;
}

function admin(u) {
  return u?.role === "admin";
}

function autoTitle(c) {
  return (
    text(c)
      .split(/\n+/)
      .find(Boolean)
      ?.slice(0, 100) || "नई कहानी"
  );
}

function autoExcerpt(c) {
  const t = text(c).replace(/\s+/g, " ");
  return t.slice(0, 180) + (t.length > 180 ? "…" : "");
}

const emojis = {
  "भूत": "👻",
  "प्रेम": "❤️",
  "प्रेरणादायक": "💡",
  "भगवान": "🙏",
  "भक्ति": "🙏",
  "परिवार": "👨‍👩‍👧",
  "रहस्यमयी": "🕵️",
  "जानवरों की कहानी": "🐯",
  "बच्चों की कहानी": "🧒",
  "News": "📰",
  "Blog": "📝"
};

async function seedIfEmpty(env) {
  const c = await env.DB
    .prepare("SELECT COUNT(*) n FROM stories")
    .first();

  if (Number(c?.n || 0) > 0) return;

  const rows = [
    [
      "seed-1",
      "ईश्वर पर भरोसा",
      "भगवान",
      "🙏",
      "एक गरीब किसान ने कठिन समय में भी भगवान पर भरोसा नहीं छोड़ा।",
      "एक गाँव में रामू नाम का किसान रहता था। एक साल बारिश नहीं हुई। खेत सूख गए, लेकिन रामू ने मेहनत और विश्वास नहीं छोड़ा। उसने रोज खेत में पानी बचाने के छोटे-छोटे उपाय किए। कुछ दिनों बाद अच्छी बारिश हुई और उसकी फसल बच गई।",
      "सिर्फ भरोसा नहीं, सही कर्म भी जरूरी है।"
    ],
    [
      "seed-2",
      "पुरानी हवेली का रहस्य",
      "रहस्यमयी",
      "🏚️",
      "एक सुनसान हवेली में हर रात सुनाई देने वाली आवाज का सच क्या था?",
      "गाँव के बाहर एक पुरानी हवेली थी। लोग कहते थे कि रात में वहाँ किसी के चलने की आवाज आती है। एक रात मोहन ने हिम्मत करके अंदर जाने का फैसला किया। उसने देखा कि टूटी खिड़की से हवा आती और लकड़ी का पुराना दरवाजा अपने आप हिलता था।",
      "हर डर के पीछे कोई कारण हो सकता है।"
    ],
    [
      "seed-3",
      "सच्चा दोस्त",
      "प्रेरणादायक",
      "💡",
      "मुसीबत में साथ देने वाला ही सच्चा दोस्त होता है।",
      "अमन और रोहन बचपन के दोस्त थे। परीक्षा के समय अमन बीमार पड़ गया। रोहन ने उसे नोट्स दिए और पढ़ाया। परीक्षा में दोनों अच्छे अंक लाए।",
      "सच्चा दोस्त मुश्किल समय में साथ देता है।"
    ],
    [
      "seed-4",
      "चतुर खरगोश",
      "जानवरों की कहानी",
      "🐇",
      "एक छोटे खरगोश ने अपनी बुद्धि से जंगल को बचाया।",
      "जंगल में एक शेर रोज जानवरों को परेशान करता था। एक दिन खरगोश ने शेर को कुएँ के पास ले जाकर पानी में उसकी परछाईं दिखाई। शेर ने उसे दूसरा शेर समझकर कुएँ में छलांग लगा दी।",
      "बुद्धि ताकत से बड़ी हो सकती है।"
    ],
    [
      "seed-5",
      "माँ की सीख",
      "परिवार",
      "👨‍👩‍👧",
      "एक बेटे को माँ की छोटी सी सीख जीवनभर याद रही।",
      "सोनू हमेशा जल्दी में काम करता था। उसकी माँ कहती थी कि हर काम सोच-समझकर करना चाहिए। एक दिन उसने बिना जाँच किए जरूरी कागज फाड़ दिया और परेशानी में पड़ गया।",
      "बड़ों की अच्छी सीख समय पर काम आती है।"
    ],
    [
      "seed-6",
      "बारिश वाली रात",
      "भूत",
      "👻",
      "एक डरावनी रात में बच्चे को मिला एक अनोखा सच।",
      "तेज बारिश वाली रात में दीपक ने अपने कमरे के बाहर किसी के रोने की आवाज सुनी। बाहर गया तो पड़ोसी की बूढ़ी दादी मिलीं, जो रास्ता भटक गई थीं। दीपक उन्हें घर तक ले गया।",
      "साहस का मतलब डर के बावजूद सही काम करना है।"
    ]
  ];

  for (const r of rows) {
    await env.DB
      .prepare(
        `INSERT OR IGNORE INTO stories
        (id,title,category,emoji,excerpt,content,lesson)
        VALUES(?,?,?,?,?,?,?)`
      )
      .bind(...r)
      .run();
  }
}

async function doLogin(id, email, env) {
  const token = uid() + uid();
  const th = await sha256(token);

  await env.DB
    .prepare(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)"
    )
    .bind(th, id, Date.now() + 2592000000)
    .run();

  const u = await env.DB
    .prepare("SELECT id,email,name,role FROM users WHERE id=?")
    .bind(id)
    .first();

  return json(
    { user: u },
    200,
    { "set-cookie": cookie(token) }
  );
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");

  try {

    /* HEALTH */

    if (request.method === "GET" && path === "health") {
      return json({
        ok: true,
        cloudflare: true,
        database: true,
        r2: false
      });
    }

    /* SIGNUP */

    if (path === "auth/signup" && request.method === "POST") {
      const b = await request.json();

      const email = text(b.email).toLowerCase();
      const password = String(b.password || "");
      const name = text(b.name);

      if (!email || password.length < 6) {
        return json(
          { error: "Email और कम से कम 6 अक्षर का password जरूरी है" },
          400
        );
      }

      const exists = await env.DB
        .prepare("SELECT id FROM users WHERE email=?")
        .bind(email)
        .first();

      if (exists) {
        return json(
          { error: "यह email पहले से registered है" },
          409
        );
      }

      /*
       * IMPORTANT:
       * केवल BOOTSTRAP_ADMIN_EMAIL admin बनेगा।
       * बाकी सभी नए accounts user होंगे।
       */

      const bootstrap =
        text(env.BOOTSTRAP_ADMIN_EMAIL).toLowerCase();

      const role =
        bootstrap && email === bootstrap
          ? "admin"
          : "user";

      const id = uid();
      const ph = await passwordHash(password);

      await env.DB
        .prepare(
          `INSERT INTO users
          (id,email,password_hash,name,role)
          VALUES(?,?,?,?,?)`
        )
        .bind(id, email, ph, name, role)
        .run();

      return await doLogin(id, email, env);
    }

    /* LOGIN */

    if (path === "auth/login" && request.method === "POST") {
      const b = await request.json();

      const email = text(b.email).toLowerCase();
      const password = String(b.password || "");

      const u = await env.DB
        .prepare("SELECT * FROM users WHERE email=?")
        .bind(email)
        .first();

      if (!u) {
        return json(
          { error: "Email या password गलत है" },
          401
        );
      }

      const ok = await verifyPassword(
        password,
        u.password_hash
      );

      if (!ok) {
        return json(
          { error: "Email या password गलत है" },
          401
        );
      }

      return await doLogin(u.id, u.email, env);
    }

    /* LOGOUT */

    if (
      path === "auth/logout" &&
      request.method === "POST"
    ) {
      const m = request.headers.get("cookie") || "";

      const token =
        (m.match(/(?:^|; )kkp_session=([^;]+)/) || [])[1];

      if (token) {
        await env.DB
          .prepare(
            "DELETE FROM sessions WHERE token_hash=?"
          )
          .bind(await sha256(token))
          .run();
      }

      return json(
        { ok: true },
        200,
        { "set-cookie": clearCookie() }
      );
    }

    /* CURRENT USER */

    if (
      path === "auth/me" &&
      request.method === "GET"
    ) {
      const u = await currentUser(request, env);
      return json({ user: u });
    }

    /* STORIES */

    if (
      path === "stories" &&
      request.method === "GET"
    ) {
      await seedIfEmpty(env);

      const q = text(
        url.searchParams.get("q")
      ).toLowerCase();

      const r = await env.DB
        .prepare(
          "SELECT * FROM stories ORDER BY created_at DESC"
        )
        .all();

      let rows = r.results || [];

      if (q) {
        rows = rows.filter(x =>
          JSON.stringify(x)
            .toLowerCase()
            .includes(q)
        );
      }

      return json({ items: rows });
    }

    /* SINGLE STORY */

    if (
      path === "story" &&
      request.method === "GET"
    ) {
      const id = text(
        url.searchParams.get("id")
      );

      const r = await env.DB
        .prepare("SELECT * FROM stories WHERE id=?")
        .bind(id)
        .first();

      if (!r) {
        return json(
          { error: "कहानी नहीं मिली" },
          404
        );
      }

      await env.DB
        .prepare(
          "UPDATE stories SET views=views+1 WHERE id=?"
        )
        .bind(id)
        .run();

      r.views = Number(r.views || 0) + 1;

      return json({ item: r });
    }

    /* POSTS */

    if (
      path === "posts" &&
      request.method === "GET"
    ) {
      const type = text(
        url.searchParams.get("type")
      );

      if (!["news", "blog"].includes(type)) {
        return json(
          { error: "Invalid type" },
          400
        );
      }

      const r = await env.DB
        .prepare(
          `SELECT * FROM posts
           WHERE type=? AND status="published"
           ORDER BY COALESCE(published_at,created_at) DESC`
        )
        .bind(type)
        .all();

      return json({
        items: r.results || []
      });
    }

    /* SINGLE POST */

    if (
      path === "post" &&
      request.method === "GET"
    ) {
      const id = text(
        url.searchParams.get("id")
      );

      const r = await env.DB
        .prepare(
          `SELECT * FROM posts
           WHERE id=? AND status="published"`
        )
        .bind(id)
        .first();

      return r
        ? json({ item: r })
        : json(
            { error: "Post नहीं मिला" },
            404
          );
    }

    /* SUBMIT STORY */

    if (
      path === "submit" &&
      request.method === "POST"
    ) {
      const b = await request.json();
      const u = await currentUser(request, env);

      const content = text(b.content);

      if (!content) {
        return json(
          { error: "कहानी जरूरी है" },
          400
        );
      }

      const title =
        text(b.title) || autoTitle(content);

      const category =
        text(b.category) || "कहानी";

      await env.DB
        .prepare(
          `INSERT INTO submissions
          (id,user_id,author_name,title,category,
           excerpt,content,lesson,image_url,video_url,status)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)`
        )
        .bind(
          uid(),
          u?.id || null,
          text(b.author_name) ||
            u?.name ||
            "Anonymous",
          title,
          category,
          text(b.excerpt) ||
            autoExcerpt(content),
          content,
          text(b.lesson),
          text(b.image_url),
          text(b.video_url),
          "pending"
        )
        .run();

      return json({ ok: true });
    }

    /* CHAT GET */

    if (
      path === "chat" &&
      request.method === "GET"
    ) {
      const u = await currentUser(request, env);

      if (!u) {
        return json(
          { error: "Login required" },
          401
        );
      }

      const r = await env.DB
        .prepare(
          `SELECT c.id,c.message,c.created_at,
                  u.name,u.email
           FROM chat_messages c
           JOIN users u ON u.id=c.user_id
           WHERE c.room_id="public"
           ORDER BY c.created_at ASC
           LIMIT 300`
        )
        .all();

      return json({
        items: r.results || []
      });
    }

    /* CHAT POST */

    if (
      path === "chat" &&
      request.method === "POST"
    ) {
      const u = await currentUser(request, env);

      if (!u) {
        return json(
          { error: "Login required" },
          401
        );
      }

      const b = await request.json();
      const m = text(b.message);

      if (!m) {
        return json(
          { error: "Message खाली है" },
          400
        );
      }

      await env.DB
        .prepare(
          `INSERT INTO chat_messages
           (id,room_id,user_id,message)
           VALUES(?,?,?,?)`
        )
        .bind(
          uid(),
          "public",
          u.id,
          m.slice(0, 1000)
        )
        .run();

      return json({ ok: true });
    }

    /* ANALYTICS */

    if (
      path === "analytics" &&
      request.method === "POST"
    ) {
      const b = await request.json();

      await env.DB
        .prepare(
          `INSERT INTO page_views
           (path,story_id)
           VALUES(?,?)`
        )
        .bind(
          text(b.path).slice(0, 300),
          text(b.story_id) || null
        )
        .run();

      return json({ ok: true });
    }

    if (
      path === "analytics" &&
      request.method === "GET"
    ) {
      const u = await currentUser(request, env);

      if (!admin(u)) {
        return json(
          { error: "Admin required" },
          403
        );
      }

      const total = await env.DB
        .prepare(
          "SELECT COUNT(*) n FROM page_views"
        )
        .first();

      const today = await env.DB
        .prepare(
          `SELECT COUNT(*) n
           FROM page_views
           WHERE date(created_at)=date('now')`
        )
        .first();

      const stories = await env.DB
        .prepare(
          "SELECT COALESCE(SUM(views),0) n FROM stories"
        )
        .first();

      return json({
        pageViews: Number(total?.n || 0),
        today: Number(today?.n || 0),
        storyViews: Number(stories?.n || 0)
      });
    }

    /* ADMIN STORIES */

    if (
      path === "admin/stories" &&
      request.method === "GET"
    ) {
      const u = await currentUser(request, env);

      if (!admin(u)) {
        return json(
          { error: "Admin required" },
          403
        );
      }

      await seedIfEmpty(env);

      const r = await env.DB
        .prepare(
          "SELECT * FROM stories ORDER BY created_at DESC"
        )
        .all();

      return json({
        items: r.results || []
      });
    }

    /* ADMIN CREATE / UPDATE STORY */

    if (
      path === "admin/story" &&
      request.method === "POST"
    ) {
      const u = await currentUser(request, env);

      if (!admin(u)) {
        return json(
          { error: "Admin required" },
          403
        );
      }

      const b = await request.json();
      const content = text(b.content);

      if (!content) {
        return json(
          { error: "कहानी जरूरी है" },
          400
        );
      }

      const id = text(b.id) || uid();

      const title =
        text(b.title) ||
        autoTitle(content);

      const category =
        text(b.category) ||
        "भगवान";

      const emoji =
        text(b.emoji) ||
        emojis[category] ||
        "📖";

      const excerpt =
        text(b.excerpt) ||
        autoExcerpt(content);

      if (b.id) {
        await env.DB
          .prepare(
            `UPDATE stories SET
             title=?,category=?,emoji=?,excerpt=?,
             content=?,lesson=?,image_url=?,video_url=?,
             updated_at=?
             WHERE id=?`
          )
          .bind(
            title,
            category,
            emoji,
            excerpt,
            content,
            text(b.lesson),
            text(b.image_url),
            text(b.video_url),
            now(),
            id
          )
          .run();
      } else {
        await env.DB
          .prepare(
            `INSERT INTO stories
             (id,title,category,emoji,excerpt,content,
              lesson,image_url,video_url)
             VALUES(?,?,?,?,?,?,?,?,?)`
          )
          .bind(
            id,
            title,
            category,
            emoji,
            excerpt,
            content,
            text(b.lesson),
            text(b.image_url),
            text(b.video_url)
          )
          .run();
      }

      return json({
        ok: true,
        id
      });
    }

    /* ADMIN DELETE STORY */

    if (
      path === "admin/story" &&
      request.method === "DELETE"
    ) {
      const u = await currentUser(request, env);

      if (!admin(u)) {
        return json(
          { error: "Admin required" },
          403
        );
      }

      const id = text(
        url.searchParams.get("id")
      );

      await env.DB
        .prepare("DELETE FROM stories WHERE id=?")
        .bind(id)
        .run();

      return json({ ok: true });
    }

    /* ADMIN POSTS */

    if (
      path === "admin/posts" &&
      request.method === "GET"
    ) {
      const u = await currentUser(request, env);

      if (!admin(u)) {
        return json(
          { error: "Admin required" },
          403
        );
      }

      const r = await env.DB
        .prepare(
          "SELECT * FROM posts ORDER BY created_at DESC"
        )
        .all();

      return json({
        items: r.results || []
      });
    }

    /* ADMIN CREATE / UPDATE POST */

    if (
      path === "admin/post" &&
      request.method === "POST"
    ) {
      const u = await currentUser(request, env);

      if (!admin(u)) {
        return json(
          { error: "Admin required" },
          403
        );
      }

      const b = await request.json();

      const type = text(b.type);

      if (!["news", "blog"].includes(type)) {
        return json(
          { error: "Type invalid" },
          400
        );
      }

      const id = text(b.id) || uid();
      const title = text(b.title);
      const content = text(b.content);

      if (!title || !content) {
        return json(
          { error: "Title और content जरूरी हैं" },
          400
        );
      }

      const status =
        text(b.status) || "published";

      const publishedAt =
        status === "published"
          ? now()
          : null;

      if (b.id) {
        await env.DB
          .prepare(
            `UPDATE posts SET
             type=?,title=?,category=?,excerpt=?,
             content=?,image_url=?,status=?,
             published_at=?,updated_at=?
             WHERE id=?`
          )
          .bind(
            type,
            title,
            text(b.category),
            text(b.excerpt) ||
              autoExcerpt(content),
            content,
            text(b.image_url),
            status,
            pu
