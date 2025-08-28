# Twitch Sub Gallery (Pink & Cutesy)

- Backend: Node/Express + Prisma, deploy with Render.
- Frontend: 5 files for Twitch Extension hosting (Panel + Config).
- EBS base URL used in frontend: **https://twitch-subgallery-1.onrender.com**

## Deploy (Render)
Root Directory: `backend`  
Build: `npm install && npx prisma generate && npm run build`  
Start: `npm start`

After deploy: open Shell → `npx prisma migrate deploy` → check `GET https://twitch-subgallery-1.onrender.com/health`.

## Twitch Console
- Upload `frontend/` files as a single zip in **Files/Asset Hosting**.
- Views: Panel=`viewer.html`, Config=`config.html`.
- Bits SKUs: TIP_100, TIP_500, TIP_1000, COMMENT_500 (Broadcast ON).
- Capabilities: Bits + Subscriber support.
- Allowlist URL Fetching Domains: `https://twitch-subgallery-1.onrender.com`.
