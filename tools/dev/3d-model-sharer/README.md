# Sketchfab IO

Single-file static web tool for previewing, importing, and uploading Sketchfab 3D models.

No npm.  
No Vite.  
No backend server.  
No OAuth server.  
No build step.

The dashboard embeds this tool as its own three-column workspace. The left column keeps Sketchfab search/import results, the center column is the viewer, and the right column owns upload, texture, API key, publish, and scene controls. Both internal sidebars opt out of dashboard sidebar mirroring so the server-hosted view matches the direct tool page.

Open:

```text
index.html
```

## Fix in this build

The previous build sent:

```text
license=cc-by
```

Sketchfab rejects that.

The valid Sketchfab license choices are:

```text
by
by-sa
by-nd
by-nc
by-nc-sa
by-nc-nd
cc0
st
ed
qx
free-st
```

The tool now sends the exact slug selected in the Download dropdown.

## Download behavior

Sketchfab’s upload API does not use a simple `download=Free` field.

Downloadability is controlled by setting a valid `license`.

The tool maps:

- No downloads → no `license` field is sent
- Free download → sends the chosen license slug, for example `by`
- Store → not sent, because store listing is not available through the public upload API

## Website-only toggles

The following toggles are visible on Sketchfab’s website UI, but are not documented writable upload API fields:

- Allow comments
- Promotional content
- Created with generative AI tools

So the tool no longer sends fake fields for them.

### Is there really no way?

Not through the documented public upload API.

Possible alternatives:

1. Change those settings manually on Sketchfab after upload.
2. Use tags where appropriate, for example `CreatedWithAI` or `NoAI`, but that is not the same as the website toggle.
3. Ask Sketchfab/Fab support for partner/private API access if your app needs those fields officially.

## Supported upload fields kept in the tool

- name
- description
- tags
- categories
- private visibility
- isPublished
- isInspectable
- isAgeRestricted
- license

## Private models

Private/password-protected models require Sketchfab Pro.

## FBX texture patch

For packed FBX files where embedded texture references end in `.fbm`, the tool patches the FBX before preview and upload so texture importers see `.png`, `.jpg`, `.tga`, or `.bmp` instead of `.fbm`.


## Fix in this build

The previous build unintentionally enabled:

```text
isInspectable=1
```

whenever a downloadable license was selected.

This build fixes that.

Now:
- Download license selection only sets the license
- Texture inspection is controlled only by the actual toggle
- If the toggle is OFF, the upload sends:

```text
isInspectable=0
```


## AI-created model reminder

Sketchfab’s **Created with generative AI tools** website toggle is not exposed as a documented public upload API field.

This build adds:

- an in-tool warning
- a checkbox: “This model used generative AI tools”
- post-upload links:
  - View uploaded model
  - Open model properties

After upload, click **Open model properties** and enable the AI disclosure manually if applicable.

Example properties URL format:

```text
https://sketchfab.com/3d-models/<MODEL_UID>/properties
```


## Auto-open properties page

If the checkbox:

```text
This model used AI (Open Model Properties after Upload)
```

is enabled, the tool automatically opens the uploaded model's Sketchfab properties page after upload so the user can quickly enable the website-only AI disclosure toggle.


## License selector update

The Download UI now shows only:

- No
- Free
- Store

When **Free** is selected, a **Change License** button appears.

The default free license is:

```text
CC Attribution
```

which uploads as:

```text
license=by
```

The license modal supports:

- Free Standard
- CC Attribution
- Non Commercial
- No derivatives
- Share alike

The generated Sketchfab license slugs are:

```text
by
by-sa
by-nd
by-nc
by-nc-sa
by-nc-nd
free-st
```

Store remains an informational option because the public upload API does not expose Store/Fab listing setup.
