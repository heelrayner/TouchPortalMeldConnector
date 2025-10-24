# Meld Studio Control for Touch Portal

Meld Studio Control is a Touch Portal v3+ plugin that exposes the full Meld Studio automation surface. The plugin can communicate via the native Qt WebChannel/JSON-RPC server or by shelling out to the official `@onyx-and-iris/meld-cli` utility. Actions, states and dynamic choices are refreshed in realtime so Touch Portal pages always reflect the live Meld configuration.

## Features

- **Transport abstraction** – swap between WebChannel and CLI without redeploying the plugin.
- **Dynamic discovery** – scenes, sources, items, filters, transitions, hotkeys and projects populate automatically.
- **High coverage** – actions for scenes, scene items, sources, audio, filters, transitions, streaming/recording, media, capture, project management and advanced automation.
- **Realtime state engine** – streaming/recording states, output metrics, audio mix meters and media status update through event subscriptions or configurable polling.
- **Resilience** – automatic reconnection with exponential backoff, optional high-frequency metrics polling and inline error notifications in Touch Portal.

## Installation

1. Ensure Node.js LTS (18+) is installed on the machine running Touch Portal.
2. Download the release `.tpp` file (build instructions below) and import it in Touch Portal (`Settings` → `Plug-ins` → `Import Plug-in`).
3. After import, locate **Meld Studio Control** in the Touch Portal plug-ins list and configure:
   - Host/port of the Meld Studio instance.
   - Authentication token if required by your Meld configuration.
   - Preferred transport (`Qt WebChannel` or `Meld CLI`). When CLI is selected provide the executable path.
   - Poll intervals, metrics toggles and log level to tune performance.
4. Press **Save** and the plugin will initialise. A status toast is shown if connection fails.

## Build & packaging

The Touch Portal `.tpp` artifact is a ZIP archive containing this folder and the `entry.tp` manifest.

```bash
npm install
npm run test
zip -r MeldStudioControl.tpp entry.tp package.json package-lock.json src README.md icons
```

The generated `.tpp` can then be imported directly.

> **Note:** The development container used for this repository does not ship with Node modules installed. Run `npm install` locally before packaging.

## Settings overview

| Setting | Description |
| --- | --- |
| Meld Host / Port | WebChannel host and port (default `127.0.0.1:4455`). |
| Authentication Token | Optional bearer token for secured Meld instances. |
| Primary Transport | Choose between WebChannel and CLI. |
| CLI Executable Path | Path to `meld-cli` when using CLI transport. |
| Poll Interval | Base interval for low-frequency state polling. |
| High Frequency Metrics | Enable additional polling for FPS, bitrate and peaks. |
| Metrics Interval | Interval for the high frequency poller. |
| Log Level | Runtime log verbosity. |

## Capability matrix

| Meld feature | Touch Portal actions | States/Events |
| --- | --- | --- |
| Scenes | Switch Scene, Create Scene, Rename Scene, Delete Scene, Set Transition, Trigger Transition | `meld.currentScene`, `meld.sceneList`, `meld.previewScene` |
| Scene Items | Set Item Visibility, Adjust Item Transform, Set Item Order | Included in `meld.audio.mix` for visibility/transform snapshots |
| Sources | Add Source, Remove Source, Reload Source, Configure Source | `meld.media.status` (for media sources), dynamic choices |
| Filters | Toggle Filter, Set Filter Property | Dynamic connectors update per source |
| Audio | Set Source Mute, Set Source Volume, Set Monitor Mode | `meld.audio.mix` JSON payload per source |
| Transitions | Set Current Transition, Set Transition Duration | `meld.streaming.status` reflects transition readiness |
| Streaming & Outputs | Toggle Stream, Toggle Recording, Toggle Virtual Camera | `meld.streaming.status`, `meld.recording.status`, `meld.virtualcam.status`, `meld.streaming.uptime`, `meld.recording.uptime` |
| Media | Media Control, Seek Media | `meld.media.status` JSON payload |
| Capture | Take Screenshot, Save Replay/Clip | – |
| Project/Profile | Load Project, Save Project, Switch Profile, Switch Scene Collection | `meld.project.name`, `meld.profile.name`, `meld.collection.name` |
| Advanced | Trigger Hotkey, Execute Raw Command | Notifications + manual command execution |

## Testing

The project ships with Jest unit tests covering the capability matrix helpers. Run:

```bash
npm test
```

Integration validation requires a running Meld Studio instance exposing WebChannel or CLI. Use the `tests/mockTransport` pattern as a template for bespoke automation.

## Troubleshooting

- **Connection stuck at “connecting”** – verify the WebChannel port and that Meld Studio has remote control enabled. Review plugin logs in the Touch Portal console.
- **Dynamic lists empty** – trigger the `Refresh choices` command in Touch Portal or reload the plugin after ensuring Meld is online.
- **High CPU usage** – disable high frequency metrics or increase polling intervals.

## License

MIT © 2024
