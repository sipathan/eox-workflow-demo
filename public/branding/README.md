# Brand assets

## Cisco logo (`public/branding/cisco-logo.svg`)

The app ships the **Cisco wordmark SVG** from **Wikimedia Commons**:

- **File page:** [File:Cisco_logo.svg](https://commons.wikimedia.org/wiki/File:Cisco_logo.svg)
- **Direct file (same revision as vendored):** `https://upload.wikimedia.org/wikipedia/commons/6/64/Cisco_logo.svg`

**Legal / brand:** The Commons file page states the **license** for the vector work and any **trademark** notices. Use this demo asset in line with that license and **Cisco trademark** rules for your environment. For production or external distribution, prefer artwork from **internal Cisco brand** channels if your policy requires it.

**Format:** SVG (scalable, transparent background, `width="72"` `height="38"` in source). The UI constrains display height via Tailwind (`h-7`, `h-8`, `h-9`, etc.) and `object-contain` to preserve aspect ratio.

**Replacing the file:** Overwrite `public/branding/cisco-logo.svg` with another **approved** SVG if needed; keep valid XML. Optional PNG fallback would require updating `CiscoBrandLogo.tsx` to point at e.g. `/branding/cisco-logo.png` and matching dimensions.
