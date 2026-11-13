/**
 * HiM Cooks – Live Callout Listener (Railway)
 * -------------------------------------------
 * Deploy on Railway. Exposes:
 *   GET  /callouts/latest   → JSON for HiM Cooks panel
 *   POST /callouts/ingest   → push a new callout (webhook / manual)
 *   GET  /health            → health check
 *
 * Env (optional):
 *   PUMPFOMO_API_KEY  – if set, can poll pumpfomo
 *   PORT              – Railway sets this
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

const PORT = process.env.PORT || 3000;
const MAX_STORE = 80;

/** In-memory store of recent callouts (newest first) */
let callouts = [];

function normalizeCallout(c) {
  if (!c || !c.mint) return null;
  const calledAt = c.calledAt
    ? Number(c.calledAt) < 1e12
      ? Number(c.calledAt) * 1000
      : Number(c.calledAt)
    : Date.now();
  const ageMinutes = Math.max(0, Math.round((Date.now() - calledAt) / 60000));
  return {
    id: c.id || c.calloutId || String(c.mint) + "-" + calledAt,
    mint: String(c.mint),
    symbol: c.symbol || "???",
    name: c.name || c.symbol || "Unknown",
    thesis: c.thesis || c.text || "",
    marketCapAtCall: c.marketCapAtCall != null ? Number(c.marketCapAtCall) : (c.marketCap != null ? Number(c.marketCap) : null),
    calledAt,
    callerName: c.callerName || c.userName || c.author || "Caller",
    callerWallet: c.callerWallet || c.userId || null,
    strength: c.strength === "high" ? "high" : "medium",
    ageMinutes,
  };
}

function upsertCallout(raw) {
  const row = normalizeCallout(raw);
  if (!row) return null;
  // dedupe by mint + rough time window
  callouts = callouts.filter(function (x) {
    return !(x.mint === row.mint && Math.abs(x.calledAt - row.calledAt) < 120000);
  });
  callouts.unshift(row);
  if (callouts.length > MAX_STORE) callouts = callouts.slice(0, MAX_STORE);
  return row;
}

// Refresh ageMinutes on read
function listCallouts(maxAgeMin) {
  const maxAge = maxAgeMin != null ? Number(maxAgeMin) : 180;
  const now = Date.now();
  return callouts
    .map(function (c) {
      return Object.assign({}, c, {
        ageMinutes: Math.max(0, Math.round((now - c.calledAt) / 60000)),
      });
    })
    .filter(function (c) {
      return c.ageMinutes <= maxAge;
    });
}

app.get("/health", function (_req, res) {
  res.json({ ok: true, count: callouts.length, time: new Date().toISOString() });
});

/**
 * Main endpoint for HiM Cooks
 * Same shape as netlify/functions/callouts.js
 */
app.get("/callouts/latest", function (req, res) {
  const maxAge = req.query.maxAge != null ? Number(req.query.maxAge) : 180;
  const rows = listCallouts(maxAge);
  res.json({
    source: "railway-live",
    updatedAt: new Date().toISOString(),
    callouts: rows,
  });
});

/** Also accept root for convenience */
app.get("/", function (_req, res) {
  res.json({
    service: "him-cooks-callout-listener",
    endpoints: {
      latest: "/callouts/latest",
      ingest: "POST /callouts/ingest",
      health: "/health",
    },
  });
});

/**
 * Ingest a callout (from webhook, script, or manual curl)
 * Body example:
 * {
 *   "mint": "...",
 *   "symbol": "PEPE",
 *   "thesis": "clean chart + early volume",
 *   "marketCapAtCall": 42000,
 *   "callerName": "Alpha",
 *   "strength": "high"
 * }
 */
app.post("/callouts/ingest", function (req, res) {
  const row = upsertCallout(req.body || {});
  if (!row) {
    return res.status(400).json({ ok: false, error: "mint required" });
  }
  console.log("[ingest]", row.symbol, row.mint.slice(0, 8) + "…", row.strength);
  res.json({ ok: true, callout: row, total: callouts.length });
});

/** Bulk ingest */
app.post("/callouts/ingest-bulk", function (req, res) {
  const list = Array.isArray(req.body) ? req.body : (req.body && req.body.callouts) || [];
  let n = 0;
  list.forEach(function (c) {
    if (upsertCallout(c)) n += 1;
  });
  res.json({ ok: true, ingested: n, total: callouts.length });
});

app.listen(PORT, function () {
  console.log("HiM Cooks callout listener on :" + PORT);
  console.log("Paste this in HiM Cooks panel:");
  console.log("  https://YOUR-RAILWAY-DOMAIN/callouts/latest");
});
