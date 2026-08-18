---
title: "Introducing URage Now and URage Companion"
description: "A local-first creative workspace that turns AI-generated media into the next useful action—on desktop and Android."
published: false
tags: [urage-now, creative-tools, local-first, android]
---

# ✨ Introducing URage Now and URage Companion

> **Create → refine → send → keep moving.**
>
> URage Now is a local-first creative workspace for Chat, Image, 3D, Audio, Music, Video, tools, and optional messenger workflows. **URage Companion** brings the same studio to Android.

🔗 [URage Now on GitHub](https://github.com/sysoutch/URageNow) · [URage Companion on GitHub](https://github.com/sysoutch/urage-now-android-companion)

![URage Now hero: the flame-mask logo beside LazyDev Home workflow and usage statistics](/blog/images/urage-now-lazydev-hero.png)

![URage Now dashboard overview](/blog/images/1786879902994-grafik.webp)

## 🧭 What makes it different?

Most creative-AI tools stop at a result. URage Now is built around the *next step*: an image can become a 3D model, a video source, a low-poly asset, a rotating preview, an input for a tool, or a handoff to a game engine or 3D application.

| You are working on… | URage Now helps you… | Then you can… |
| --- | --- | --- |
| 💬 An idea | Plan and iterate in Chat Studio | Turn it into a media workflow |
| 🖼 An image | Generate, edit, interpret, and organize it | Create 3D, video, pixel art, normal maps, and more |
| 🧊 A 3D asset | Preview, inspect, validate, rig, or simplify it | Send it to Blender, a game engine, or print tooling |
| 📱 A mobile moment | Start work, monitor jobs, review media | Continue with the paired desktop studio |

![URage Now studio overview](/blog/images/1786879970713-grafik.webp)

## ⚡ Quick actions: the workflow does not end at “Generate”

This is the heart of URage Now. **Image Studio and 3D Studio put action buttons directly beside the selected result**, so a creator does not have to download a file, search for the next application, and recreate the context.

### 🖼 Image Studio

![Image Studio quick actions: 3D, video, pixel art, normal maps, background removal, upscaling, and more](/blog/images/urage-image-quick-actions.png)

| Quick action | What it unlocks |
| --- | --- |
| 🧊 **Create 3D From Preview** | Start an image-to-3D workflow from the selected result |
| 🎞 **Generate Video From Image** | Use the current image as an image-to-video source |
| 🔄 **Rotate 360 Clip** | Create a rotating presentation clip |
| ✂ **Remove Background** / **Remove Background + Crop** | Prepare a cleaner asset for compositing or export |
| 🎨 **Convert to Pixel Art** | Produce a game-friendly stylized variant |
| ✨ **Delight Image** / **Upscale** | Improve lighting or resolution without leaving the studio |
| 🗺 **Create Normal Map** | Prepare a material-oriented derivative |
| 🧰 **Send To …** | Hand the result to dashboard tools or a configured destination |

> 💡 Generated history images and uploaded edit sources use the same action path—including GIF inputs—so the buttons act on the image you are actually viewing.

![URage Now Image Studio](/blog/images/1786879521743-grafik.webp)

### 🧊 3D Studio

![3D Studio quick actions: Blender, loose-part separation, rotation, low-poly conversion, rigging, and Send To](/blog/images/urage-3d-quick-actions.png)

- 🪶 **Create Lowpoly** with a target face count.
- 🔄 **Rotate** an asset and retain generated preview imagery or a rotating GIF.
- 🧩 **Separate By Loose Parts** for further editing.
- 🦴 **Open Rig Panel** for the AutoRig workflow and visual marker placement.
- 🌀 **Open In Blender** for an intentional desktop handoff.
- 📤 **Send To …** for tools, game engines, 3D suites, and 3D-print applications.

## 📤 Send To …: work with specialist tools, not against them

URage Now is not trying to replace Blender, Unity, Godot, Unreal, or Bambu Studio. It reduces the friction between an AI-generated asset and the specialist tool that makes it useful.

<pre style="text-align: left !important; margin-left: 0 !important; margin-right: auto !important; white-space: pre; overflow-x: auto;">
💭 IDEA
│
▼
🖼️ IMAGE / CONCEPT
│
▼
🧊 3D MODEL
│
├────────────────┐
▼                ▼
🪶 LOW-POLY       🎞️ PREVIEW
│                │
└────────┬───────┘
         ▼
      🧰 TOOLCHAIN
         │
   ┌─────┼─────┬─────┐
   ▼     ▼     ▼     ▼
 🧰 Tools  🎮 Engines  🌀 3D Suites  🖨️ 3D Print
</pre>

| Destination | Example outcome |
| --- | --- |
| 🧰 **Dashboard tools** | Continue with image, art, media, or planning utilities |
| 🎮 **Unity · Godot · Unreal** | Use dedicated asset workflows for game-engine work |
| 🌀 **Blender and 3D suites** | Open a selected asset in the configured desktop application |
| 🖨 **Bambu Studio** | Hand a selected model to a 3D-print preparation workflow |

For safety, desktop handoffs are explicit host-side actions. URage Now validates the selected application and arguments instead of accepting arbitrary shell commands.

![URage Now 3D workflow](/blog/images/1786879814520-grafik.webp)

## 🎨 One studio, many media types

| Studio | Focus |
| --- | --- |
| 💬 **Chat** | LazyDev conversations, planning, prompts, Markdown, attachments, skills, and tools |
| 🖼 **Image** | Prompting, references, interpretation, editing, and quick-action handoffs |
| 🧊 **3D** | Image-first model creation, previews, low-poly work, validation, rigging, and desktop handoffs |
| 🔊 **Audio** | Prompt-driven sound effects and ambience |
| 🎵 **Music** | Tags, optional lyrics, and duration-oriented generation |
| 🎞 **Video** | Prompt and image-to-video workflows with focused controls |
| 🧰 **Tools** | Supporting utilities beside the media workflow |

![URage Now Tools dashboard](/blog/images/1786880059659-grafik.webp)

### Some of our favorites tools

![Interactive Book Creator](/blog/images/1786882286642-grafik.webp)

## 📱 URage Companion: your studio on Android

URage Companion is a mobile client for the same workspace—not a separate server and not a stripped-down remote-control screen. Pair it with a dashboard to start workflows, monitor durable background jobs, receive completion notifications, browse the Gallery, and transfer media.

| On your phone | What it means |
| --- | --- |
| 📷 **Capture and upload** | Use camera or local media as image, video, or 3D sources |
| ⏳ **Durable jobs** | Generation and transfer work survives app and activity restarts |
| 🔔 **Completion notifications** | Tap a finished job to open its result in Gallery |
| 🖼 **Gallery** | Browse thumbnails, preview media, download, upload, and optionally keep offline copies |
| 🎨 **Theme sync** | Follow the paired desktop theme or keep a phone-specific override |
| 🔒 **Scoped pairing** | Pair with a short-lived QR code or one-time code; review and revoke devices on the dashboard |

![URage Companion home workspace](/blog/images/urage-companion-home.png)

### 🔐 Local when possible, remote when configured

The companion discovers and pairs with a dashboard on a trusted LAN. It uses a short-lived QR code or fallback code, and the dashboard manages scoped, revocable device access. For deliberately configured remote workflows, the companion can use an encrypted Matrix relay.

![URage Companion connection and pairing](/blog/images/urage-companion-pairing.png)

> 🔒 The dashboard and discovery ports are not intended for public-internet exposure. LAN pairing and Matrix relay are separate, explicit choices.

## 🏠 Local-first by design

URage Now runs on your Windows machine in a browser or Tauri desktop shell. You choose the provider path: local models, ComfyUI, OpenAI-compatible services, desktop software, optional remote workers, and optional messenger adapters.

| Component | Responsibility |
| --- | --- |
| 🖥 **Dashboard** | UI, authenticated API, job coordination, settings, and media access |
| ⚙ **Server layer** | Application services, provider connections, and shared workflow logic |
| 🧑💻 **Remote worker** | Optional, explicit execution on another GPU, machine, Windows user, or Blender environment |
| 💬 **Messengers** | Optional Discord, Telegram, Matrix, and WhatsApp adapters into the same workflows |
| 📱 **Companion** | Android access to the paired studio—not another source of workflow rules |

## 🚀 Start building

```powershell
npm install
copy .env.public.example .env.public.local
npm run start:dashboard
```

Open `http://127.0.0.1:4782`, configure the provider and companion settings you need, and keep credentials out of committed environment files.

---

**URage Now is for creators who want the result to go somewhere.** ✨

*Individual capabilities depend on the providers, models, hardware, and permissions you configure.*
