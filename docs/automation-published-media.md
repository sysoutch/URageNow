# Automation published-media feed

Enable **Automation → Website Feed → Write sent media links to the website feed** to maintain `automation-published-media.json` in `DASHBOARD_DATA_DIR`.

The file is a bounded JSON feed (the most recent 1,000 deliveries) with a schema version, delivery time, automation identity, destination, and media URLs. It is written atomically, so a website reader never sees a partial document.

The feed is available in the dashboard at `/api/automation-published-media`, or through **Automation → Website Feed → Open feed JSON**. It follows the dashboard's existing generated-media access model. Dashboard URLs are based on `DASHBOARD_PUBLIC_BASE_URL` and are used instead of transient Discord attachment URLs.

When Dashboard API access is protected, gallery publishing sends the configured Dashboard access token server-to-server while retrieving the generated file. It is never appended to a generated-media URL or written into the feed.

## URageNet Media Library publishing

For a scheduled Discord image or 3D-model automation, enable **Upload generated media to the URageNet Media Library**. The automation posts normally to Discord, then uploads each dashboard-owned generated asset to URageNet with its application-password API. The feed is written automatically for this option and contains the permanent URageNet URLs.

Configure the connection in **Automation → Website Feed** in the Dashboard. The application password is write-only and is saved in the host's native secret store; it is never returned to the browser or stored in the automation feed. Environment variables remain available for unattended/server setup:

```dotenv
URAGENET_MEDIA_API_BASE_URL=https://www.urage.net
URAGENET_MEDIA_API_USERNAME=automation-user
URAGENET_MEDIA_API_PASSWORD=application-password
```

Create the application password in URageNet Admin → Users. Do not place it in a scheduled automation record, the dashboard feed, or a client-side setting.

URageNet's `POST /api/media/upload` accepts images, videos, and 3D-model files (`.glb`, `.gltf`, `.fbx`, `.obj`, `.stl`, `.usdz`) in multipart field `file`. Automated uploads use the `urage-now-automation` category and gallery visibility. They appear in Admin → Media Library; the public `/images` route still intentionally lists images only.

## Messenger rollout plan

| Messenger | Current capability | Remaining work |
| --- | --- | --- |
| Discord | Scheduled image and 3D jobs write dashboard-owned URLs. They can additionally publish generated files to URageNet Media Library. | Capture video/GIF follow-up receipts in the same feed entry. |
| Telegram | Scheduled media has no safe public attachment URL. | Add a token-safe website resolver for Telegram file IDs; do not expose Bot API URLs containing the bot token. |
| Matrix | Scheduled media has no safe public attachment URL. | Add an authenticated `mxc://` resolver/permalink policy before treating Matrix media as website-direct. |
| WhatsApp | Text-only admin bridge; scheduled media automation does not exist. | Add Cloud API media upload/document sending, then scheduled media generation/delivery, then a resolver policy for short-lived WhatsApp media URLs. |
