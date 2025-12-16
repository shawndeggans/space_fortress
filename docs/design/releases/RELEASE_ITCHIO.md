# Deploying TypeScript games to itch.io with GitHub Actions

Automating HTML5 game deployment to itch.io requires Butler CLI, proper zip structure with `index.html` at root, and a GitHub Actions workflow that builds your TypeScript project, authenticates via API key, and pushes to a named channel. **Butler's differential upload system means subsequent deploys only transfer changed data**, typically reducing upload sizes by 80-95% after the initial push. This guide provides complete, production-ready workflow configurations.

## itch.io HTML5 requirements set firm boundaries

Your zip archive must contain `index.html` at the root level—not in a subfolder. itch.io extracts your zip and serves files from a CDN (`v6p9d9t4.ssl.hwcdn.net`), embedding your game in an iframe on the project page. There's no server-side routing, so requesting directory paths returns 403 errors.

**Critical constraints for HTML5 games:**

| Limit | Value |
|-------|-------|
| Maximum extracted size | **500 MB** |
| Maximum file size | **200 MB** |
| Maximum file count | **1,000 files** |
| Path length | 240 characters |
| Archive format | ZIP only |

File references must use **relative paths only**—absolute paths starting with `/` will fail. File names are case-sensitive; `Assets/sprite.PNG` and `assets/sprite.png` are different files. All external resource requests must use HTTPS.

itch.io automatically applies gzip compression to `html`, `js`, `css`, `svg`, `wasm`, `wav`, `glb`, and `pck` files. Unity 2020+ Brotli-compressed `.br` files are served with proper `content-encoding: br` headers automatically.

## Butler CLI handles authentication and differential uploads

Butler is itch.io's command-line upload tool built on the Wharf protocol—an rsync-like system that only uploads changed 64KB blocks between versions. Install it in CI environments using the permanent broth URL:

```bash
curl -L -o butler.zip https://broth.itch.zone/butler/linux-amd64/LATEST/archive/default
unzip butler.zip
chmod +x butler
./butler -V
```

### Authentication requires an API key for CI

Generate your API key by running `butler login` locally, then visiting https://itch.io/user/settings/api-keys. Find the key with source "wharf" or create a new one. In CI, Butler reads credentials from the `BUTLER_API_KEY` environment variable:

```bash
export BUTLER_API_KEY=your_key_here
butler push ./dist username/game-name:html5
```

### Push command syntax follows a strict pattern

```bash
butler push DIRECTORY USER/GAME:CHANNEL [--userversion VERSION]
```

The **channel name** determines platform tagging. Keywords `win`, `linux`, `mac`, and `android` automatically tag builds for those platforms. For HTML5 games, use `html5` as the channel—you'll need to manually mark it as "Playable in browser" in your project settings after the first push.

```bash
# Standard HTML5 push
butler push ./dist myuser/awesome-game:html5 --userversion 1.2.0

# Skip upload if unchanged
butler push ./dist myuser/awesome-game:html5 --if-changed

# Preview without uploading
butler push ./dist myuser/awesome-game:html5 --dry-run
```

## Complete GitHub Actions workflow for TypeScript deployment

This workflow triggers on version tags, builds a Vite/TypeScript project, and deploys to itch.io. Store your API key in GitHub Secrets under **Settings → Secrets and variables → Actions → New repository secret** named `BUTLER_API_KEY`.

```yaml
# .github/workflows/deploy-itchio.yml
name: Deploy to itch.io

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

env:
  ITCH_USER: your-username
  ITCH_GAME: your-game-name

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript project
        run: npm run build

      - name: Setup Butler
        uses: jdno/setup-butler@v1

      - name: Extract version from tag
        id: version
        run: echo "version=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Push to itch.io
        run: |
          butler push dist ${{ env.ITCH_USER }}/${{ env.ITCH_GAME }}:html5 \
            --userversion ${{ steps.version.outputs.version }}
        env:
          BUTLER_API_KEY: ${{ secrets.BUTLER_API_KEY }}
```

### Alternative: Manual Butler installation without actions

If you prefer avoiding third-party actions, install Butler directly:

```yaml
- name: Install Butler
  run: |
    curl -L -o butler.zip https://broth.itch.zone/butler/linux-amd64/LATEST/archive/default
    unzip butler.zip
    chmod +x butler
    echo "$PWD" >> $GITHUB_PATH

- name: Push to itch.io
  run: butler push dist username/game:html5 --userversion ${{ github.ref_name }}
  env:
    BUTLER_API_KEY: ${{ secrets.BUTLER_API_KEY }}
```

### Continuous deployment on every main branch commit

For development builds, deploy automatically without tags:

```yaml
on:
  push:
    branches: [main]

# In the push step:
- name: Push development build
  run: |
    butler push dist ${{ env.ITCH_USER }}/${{ env.ITCH_GAME }}:html5-dev \
      --userversion dev-${{ github.run_number }}-${{ github.sha }}
  env:
    BUTLER_API_KEY: ${{ secrets.BUTLER_API_KEY }}
```

## HTML5-specific gotchas demand careful handling

### SharedArrayBuffer requires special configuration

itch.io offers experimental SharedArrayBuffer support via a checkbox in **Embed Options → Frame Options**. Enabling it moves your game to `html.itch.zone` with required COOP/COEP headers. However, **Firefox falls back to a popup window**, Safari doesn't work at all, and YouTube embeds on your page will break. Check for availability at runtime:

```javascript
if (typeof SharedArrayBuffer !== 'undefined') {
  // Use threaded code path
} else {
  // Fall back to single-threaded implementation
}
```

**Godot 4.3+** no longer requires SharedArrayBuffer for single-threaded exports, making this less critical for that engine.

### Audio autoplay is blocked by default

Chrome 66+ mutes autoplaying content. itch.io's "Click to play" option (enabled by default for new projects) solves this by requiring user interaction before the game starts. If you're handling audio manually:

```javascript
document.addEventListener('click', () => {
  if (audioContext?.state === 'suspended') {
    audioContext.resume();
  }
}, { once: true });
```

### Save data persistence is fragile across updates

This is the most insidious gotcha. **Uploading a new build can change the CDN path**, breaking localStorage and IndexedDB access to previous save data. For Unity WebGL, avoid `Application.persistentDataPath` (which includes a changing GUID) and use a fixed path:

```csharp
#if UNITY_WEBGL && !UNITY_EDITOR
string savePath = "/idbfs/your-game-name";
#else
string savePath = Application.persistentDataPath;
#endif
```

After any file write in Unity WebGL, call `JS_FileSystem_Sync()` to flush IndexedDB. For other engines, prefer localStorage over IndexedDB—it persists more reliably. **iOS Safari cannot persist data across sessions** due to iframe restrictions; only server-side storage works reliably there.

### Mobile and fullscreen have platform-specific quirks

Enable "Mobile Friendly" only after testing touch input on actual devices. iOS Safari has no fullscreen API—itch.io falls back to "maximized mode" filling the browser viewport. iPad Safari's fullscreen exits on swipe gestures, breaking swipe-based games. Unity WebGL is explicitly not mobile-friendly according to itch.io's documentation.

## Versioning and channel strategy for professional releases

Use semantic versioning with Butler's `--userversion` flag. itch.io tracks versions per channel, and desktop app users can roll back to previous versions via right-click → "Switch to another version."

```bash
# Stable releases
butler push dist user/game:html5 --userversion 1.0.0

# Beta channel for testing
butler push dist user/game:html5-beta --userversion 1.1.0-beta.1
```

For GitHub Actions, extract versions from tags or releases:

```yaml
# From release event
version: ${{ github.event.release.tag_name }}

# From tag push
version: ${GITHUB_REF#refs/tags/v}

# Development builds
version: dev-${{ github.run_number }}
```

**Best practice:** Display the version number in-game so players can report which build they're using. Use `--dry-run` before major releases to verify what Butler will upload. Keep channel names consistent—changing from `html` to `html5` creates a new channel rather than updating the existing one.

## Conclusion

The deployment pipeline reduces to four steps: build TypeScript with your bundler, ensure `index.html` sits at the build output root, authenticate Butler via environment variable, and push the directory (not a zip—Butler handles compression optimally). The **`jdno/setup-butler@v1`** action simplifies CI installation, while the `--if-changed` flag prevents unnecessary uploads when content hasn't changed. For production games, implement a beta channel workflow and thoroughly test save data persistence across updates—this single gotcha causes more player complaints than all other issues combined.