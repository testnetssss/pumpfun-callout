# HiM Cooks – Live Callout Listener (Railway)

## Deploy on Railway

1. Create a new Railway project
2. Deploy from this folder (GitHub repo or CLI)
3. Start command: `node server.js` (or `npm start`)
4. Railway gives you a public URL, e.g. `https://him-callouts-production.up.railway.app`

## Connect to HiM Cooks

1. Open HiM Cooks side panel
2. **Live Callout Feed** → paste:
   ```
   https://YOUR-RAILWAY-DOMAIN/callouts/latest
   ```
3. Click **Save & refresh callouts**

## Push a callout (test)

```bash
curl -X POST https://YOUR-RAILWAY-DOMAIN/callouts/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "TokenMintAddressHere",
    "symbol": "TEST",
    "thesis": "Strong early volume + clean chart",
    "marketCapAtCall": 35000,
    "callerName": "Manual",
    "strength": "high"
  }'
```

## Optional: pumpfomo

Set `PUMPFOMO_API_KEY` on Railway and extend `server.js` to poll strong callers (same pattern as in Netlify `callouts.js`).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/callouts/latest` | JSON for HiM Cooks |
| POST | `/callouts/ingest` | Add one callout |
| POST | `/callouts/ingest-bulk` | Add many |
| GET | `/health` | Health check |
