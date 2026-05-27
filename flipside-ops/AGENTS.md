<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# `assets/` is user-controlled

The repo's `../assets/` folder (sibling of this app) holds screenshots and files the user manages directly. Do **not** read, list, or reference anything inside `assets/` unless the user explicitly points to a specific path (e.g. "look at `assets/foo.png`"). When auditing untracked files or scanning project state, skip this folder.
