# Console remake: direction contract (development only)

Scope: `apps/web`, every route. Mode: Operate (the operator runs and approves agent work), with one Experience moment (boot).
Chosen by Kamal on 2026-09-30: "Desktop OS" over a bold restyle and a stage-mode hybrid.

**THESIS.** The console is the operating system it describes. Agents are processes shown in windows, company knowledge
is a mosaic of tiles that light up when an agent reads them, and every privileged action arrives as a system
notification. It refuses the admin-dashboard default of a sidebar, a top search field and a grid of cards.

**OWN-WORLD.** The wallpaper is a tessellated mosaic: one tessera per /org document, grouped by folder in muted mineral
hues, set in dark grout, with the rest of the field filled by dim unassigned tesserae. Windows are matte slate panels
with a 1px hairline edge, an 8px corner and a 34px title bar. Teal (#2bb8a3) is the only accent: focus, the primary
action, the live cursor. Process state keeps the console's state palette. Dotted thinking orbs mark wherever the AI
is working. Geist carries all UI text; JetBrains Mono is reserved for PIDs, paths, hashes and the terminal.

**STORY.** The operator boots the box and watches the kernel come up. They type a goal, then watch processes fork in a
window while the wallpaper shows which documents are being read, and the injected email flares red. A notification asks
for a decision; they approve it, and the journal shows the run is intact. When a document changes, its tile pulses amber
and the memories built on it are re-derived.

**FIRST VIEWPORT.**
- **Top bar (32px).** Mosaic mark and menu, the focused window's title, GPU and VRAM, an approvals bell with a count,
  the clock.
- **Wallpaper.** The mosaic fills the screen.
- **Composer.** Centred on the desktop: "What should mOSaic work on?", with priority, the Apollo prompt and Run.
- **Dock.** Bottom centre: Desktop, Tasks, Approvals, Knowledge, Memory, Audit, Agents, System, Terminal (OS-flavoured names were dropped for the ones the demo script and the screens already use). Open apps show a
  dot underneath; a working app shows an orb.

**FORM.** Desktop OS. User-pinned, so no concept roll. The build is code-led.

**SIGNATURE INTERACTION.** Live knowledge tiles: `knowledge.retrieved` events flare the tiles of the documents read,
tinted by the reading agent. Flagged documents pulse red, and stale sources pulse amber.

**FINISH.** Unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md,
and every shipping raster carrying its provenance.

## Revision 2 (2026-09-30, Kamal): macOS, light and colourful

Kamal rejected the dark slate look. What changed:
- **Theme.** Light by default (dark remains in the menu), with macOS materials: a translucent menu bar with real menus, windows with traffic lights and a centred title, and a frosted dock with magnification and bouncing badges.
- **Wallpaper.** A multicolour gradient field of glass tesserae, with each /org folder as a patch of vivid glossy tiles. Tiles still flare live and stay clear of the clock.
- **Landing.** The large clock and greeting, an "Ask mOSaic" pill, and widgets for running work, what needs you, the machine and knowledge.
- **Spotlight.** Alt+Space, or Ctrl+K, opens a floating field with a spring, blur and fade entrance. It asks mOSaic (the text runs as a task), or opens an app, task or document. It replaces the composer box and the launcher.
- **Shortcuts.**
  - Alt+` switches windows while Alt is held;
  - Alt+1 to Alt+8 open dock apps;
  - Alt+W closes, Alt+M minimises, Alt+Enter zooms;
  - Alt+D shows the desktop, Alt+T opens the Terminal, Alt+/ opens the shortcut sheet.
- **The visible run.**
  - A new task's window **docks left** and tells the run as a story (`lib/desktop/story.ts`), with a large orb and the active agent's face on the step happening now.
  - The rest of the desktop becomes the **run stage**: agents as `bot-avatars` with orbs, every referred document (flagged ones red), kernel calls and their decisions, sandbox screenshots, data tables, and the result.
  - The story already reads Person B's thought-process events.
- **Terminal.** Light, with a coloured prompt and output.
