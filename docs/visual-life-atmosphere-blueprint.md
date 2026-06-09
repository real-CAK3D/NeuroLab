# NeuroLab Visual Life & Atmosphere Blueprint

## Goal

Upgrade NeuroLab from a functional dashboard into a living top-down RPG-style operations facility.

The UI should feel alive, cozy, clean, industrial, and slightly futuristic. It should not feel like dots on a grid.

## Core Visual Rule

Employees must be animated little top-down characters, not dots, circles, or markers.

## Style Target

- Top-down tile-based RPG
- Smooth Pokemon-like movement
- Clean biotech facility
- White sterile grow-op
- Soft glass walls
- Industrial tables and equipment
- Subtle hacker neon accents
- Cozy mission-control dashboard
- Funny employee emotes
- Lively but not chaotic

## Movement System

Employees should move like top-down RPG characters.

Movement rules:

- Characters face direction before walking.
- Characters walk tile-to-tile.
- Movement is smooth between tiles.
- Employees should not teleport.
- Employees should avoid walls, furniture, and other workers.
- Employees should choose believable routes through hallways and doors.
- Employees should pause briefly at doors/workstations.
- Employees should slow slightly when tired.
- Employees should walk faster during alerts.
- Employees should wander only inside allowed room/department zones unless assigned elsewhere.

Character animation states:

- idle_down
- idle_up
- idle_left
- idle_right
- walk_down
- walk_up
- walk_left
- walk_right
- work_table
- type_computer
- inspect_equipment
- carry_box
- clean_floor
- drink_coffee
- sit_break
- talk
- alert
- tired
- celebrate
- frustrated
- thinking
- report_clipboard

Realistic movement details:

- Idle employees occasionally turn their head/body.
- Employees pause at workstations before starting work.
- Employees walk to coffee/snack area when hungry.
- Employees walk to manager office when reporting.
- Managers walk through departments to collect updates.
- Logistics workers walk between warehouse/loading dock/packaging.
- Security occasionally patrols or returns to monitor wall.
- R&D worker moves between lab bench, computer, and test rooms.
- Processing workers move between trimming tables and packaging stations.
- Cultivation workers move between clone room, mother room, grow rooms, and nutrient prep.

## Room Features

Each room should have visual objects and behavior.

Boss Office:

- Large desk
- Command monitor wall
- Report inbox/mail tray
- Office plants
- Status screen
- Boss avatar usually sits or stands near console
- Briefings appear here first

Cultivation Area:

- Clone racks
- Mother plant tables
- Grow room rows
- Grow lights
- Irrigation lines
- Nutrient tanks
- Soil/potting benches
- Watering stations
- Workers inspect plants, carry trays, clean floors

Processing/Trim Room:

- Long trim tables
- Chairs/stools
- Bins/totes
- Packaging scale
- Workstation lights
- Workers sit/stand at tables
- Animated small hand/work motions

Packaging Room:

- Shelves
- Boxes
- Label printer
- Packing table
- Outgoing cart
- Packages move visually when tasks complete

Extraction Lab:

- Sealed lab room
- CO2 extraction machine as fictional parody equipment
- Warning lights during heavy CPU/AI workloads
- Pressure gauges/meters
- Technician checks terminal/machine

R&D Department:

- Testing benches
- Grow light rigs
- Sample shelves
- Whiteboards
- Terminals
- Experiment stations
- Plant/extract test chambers
- R&D worker alternates between thinking, typing, testing, and inspecting

Security Office:

- Monitor wall
- Camera screens
- Alert panel
- Security desk
- Blinking warning indicators
- Security worker types, watches screens, patrols during alerts

Logistics/Warehouse:

- Shelves
- Boxes
- Pallets
- Loading dock door
- Carts
- Incoming/outgoing zones
- Worker carries boxes during transfers/backups

Sales/Marketing Office:

- Desks
- Meeting table
- Presentation screen
- Phones
- Whiteboard
- Worker types reports, sends messages, joins meeting room

Break Room/Kitchen:

- Coffee machine
- Snack shelf
- Table/chairs
- Fridge
- Microwave
- Employees recover hunger/fatigue here
- Employees socialize here

Bathrooms:

- Simple doors/signage
- Employees can path nearby but detailed behavior can stay abstract

Hallways:

- Clean floors
- Directional signs
- Glass panels
- Wall monitors
- Occasional camera domes
- Plants/decor
- Employees pass each other

## Atmosphere

The whole building should feel:

- Sterile but cozy
- Professional but weird
- Clean-room grow facility
- AI command center
- Semi-industrial
- Alive with small motions

Visual palette:

- Main: white, light gray, soft blue-gray
- Accents: green for cultivation, purple for R&D, red for security, yellow for logistics, teal for sales, orange for processing, gold for Boss
- Subtle neon glow on terminals
- No dark gritty crime aesthetic

Ambient life:

- Monitors flicker softly
- Grow lights pulse subtly
- Warning lights blink during alerts
- Machines idle with small animations
- Doors highlight when employees pass
- Room status lights change color
- Reports appear in Boss inbox
- Packages appear/disappear in logistics
- Task icons appear near workstations
- Employees produce emote bubbles

## Room Status Visuals

Every room should visually reflect its status.

Normal:

- Calm lighting
- Employees idle/work normally
- No alert icons

Busy:

- More workstation animations
- Employees move faster
- Task icons visible
- Room workload meter active

Overloaded:

- Warning icon over room
- Employees show stress/fatigue
- Manager may visit
- Room color accent pulses

Alert:

- Red/yellow warning indicators
- Security or manager responds
- Boss console receives briefing

Clean/Idle:

- Employees clean surfaces
- Room looks orderly
- Slower relaxed movement

Low cleanliness:

- Small clutter appears
- Employees may clean
- Manager complains

## Dashboard Life

Dashboard should feel like a control center, not static panels.

Main UI areas:

- Top status bar
- Left activity feed
- Right selected employee/room panel
- Bottom command console
- Small mini-map/facility overview
- Alert strip
- Report inbox

Activity feed should include:

- System events
- Employee chatter
- Manager summaries
- Boss briefings
- Completed tasks
- Alerts
- Intercom acknowledgements

Example feed lines:

- "Security flagged repeated Docker warnings."
- "R&D is analyzing AI workload behavior."
- "Logistics completed a backup transfer."
- "Cultivation Manager collected updates from Grow Room 2."
- "Processing requested assistance with queued tasks."
- "Boss briefing ready in office inbox."

Employee chatter:

- Should appear occasionally, not constantly.
- Should be filtered through manager/Boss flow for important updates.
- Should include small personality flavor later.

Examples:

- "I swear this server fan has a personality."
- "Grow Room 1 is calm. Too calm."
- "Packaging queue is moving smooth."
- "R&D says the model is thinking very hard."
- "Security says one container looks suspicious."

## Room Interaction Enhancements

Clicking a room should:

- Highlight the room border.
- Dim unrelated areas slightly.
- Show assigned staff.
- Show active workstation icons.
- Show current tasks.
- Show recent report snippets.
- Show room mood/status color.

Room popup should include:

- Room name
- Department
- Status
- Workload meter
- Cleanliness meter
- Staff list
- Current tasks
- Active events
- Linked system metric
- Recent reports
- Quick actions

Room quick actions:

- Request department report
- Assign employee
- Create task
- Send intercom to room
- View event history
- View analytics

## Employee Interaction Enhancements

Clicking an employee should:

- Center camera slightly or highlight employee.
- Show a nameplate.
- Show current state icon.
- Show popup card.
- Pause only that employee's optional idle behavior, not the whole sim.

Employee popup should show:

- Portrait placeholder
- Name
- Role
- Department
- State
- Mood
- Hunger
- Fatigue
- Stamina
- Stress
- Productivity
- IQ
- Current task
- Upcoming tasks
- Recent completed tasks
- Unread messages
- Current thought/status line

Employee quick actions:

- Talk
- Assign task
- Move to room
- Send to break room
- Request report
- Trigger emote
- Change priority
- Inspect history

Current thought examples:

- "Thinking about the packaging backlog."
- "Wants coffee."
- "Focused on container health."
- "Waiting for a task."
- "Annoyed by repeated alerts."
- "Feeling productive."

## Connect Real Systems To Visual Life

The dashboard should make real computer activity visible through the facility.

Examples:

High CPU:

- Extraction machine glows/warns.
- R&D terminals animate.
- R&D worker thinks/types.
- Manager may visit.
- Activity feed says: "Heavy compute load detected."

High RAM:

- Operations Manager looks concerned.
- Monitor panels show memory pressure.
- Boss receives notice.

Disk filling:

- Storage room gains clutter/boxes.
- Logistics worker gets organize/cleanup task.
- Room warning icon appears.

Docker container unhealthy:

- Security monitor flashes.
- Security worker enters ALERT.
- Boss briefing generated.

Backup running:

- Logistics worker carries package/cart.
- Loading dock lights active.
- Activity feed reports progress.

AI/Ollama active:

- R&D lights pulse.
- R&D worker thinking/typing.
- Boss receives AI summary later.

Network activity:

- Logistics dock animates.
- Packages move between zones.

## Task Visualization

Tasks should have visible presence.

Task indicators:

- Clipboard icon over workstation
- Progress ring near employee
- Subtle glow on active workstation
- Task card in room popup
- Completed task toast/feed entry

Task flow examples:

- New task appears as clipboard icon in relevant room.
- Assigned employee walks to workstation.
- Employee switches to working animation.
- Progress updates every simulation tick.
- On completion, employee reports to manager or updates feed.
- If report required, employee walks to manager office or sends message.

## Manager Life

Managers should not sit still forever.

Manager behavior:

- Patrol assigned departments
- Stop at workstations
- Collect employee updates
- Return to office
- Generate manager summary
- Walk to Boss office or send report
- Respond to alerts
- Occasionally talk to staff

Operations Manager:

- Monitors Processing, Extraction, Logistics, Security, Sales.

Cultivation Manager:

- Monitors Clone Room, Mother Room, Grow Rooms, Nutrition Prep, Potting.

Manager visual cues:

- Clipboard icon
- Thinking bubble
- Report icon
- Alert icon during escalation

## Boss Life

Boss represents user control center.

Boss behavior:

- Usually in office near console
- Receives manager reports
- Sends briefings to user
- Can issue intercom
- Reacts to critical alerts
- Shows report/mail icons when unread briefings exist

Boss office should be the "mission control brain."

Boss office visuals:

- Big wall board
- System status screens
- Report inbox
- Alert light
- Command desk

## Facility Time / Mood

Add simple facility mood.

Facility mood values:

- Calm
- Productive
- Busy
- Overloaded
- Alert
- Recovery

Mood affects:

- Background UI tone
- Feed language
- Employee pace
- Emote frequency
- Room status lights

Examples:

- Calm: slow movement, cleaning, chatting.
- Productive: steady work animations.
- Busy: more movement, task icons.
- Overloaded: stress emotes, faster walking.
- Alert: warning lights/security response.
- Recovery: break room activity, cleanup.

## Micro-Animations

Add small animations everywhere:

- Blinking monitors
- Glowing terminals
- Pulsing grow lights
- Soft room status lights
- Loading dock door indicator
- Coffee steam
- Printer blinking
- Package movement
- Report inbox badge
- Alert icon bounce
- Employee emote pop/fade
- Task completion sparkle/confetti, very subtle

## Visual Priorities

Build visuals in this order:

1. Replace dots with simple animated RPG characters.
2. Add room furniture/equipment placeholders.
3. Add directional walking animations.
4. Add emote bubbles.
5. Add room status lighting/icons.
6. Add task indicators.
7. Add manager/Boss reporting visuals.
8. Add real system visual reactions.
9. Add ambient animations.
10. Add polished art later.

## Technical Implementation Notes

Phaser:

- Use tilemap or grid-based room layout.
- Create EmployeeSprite class.
- Create RoomZone class.
- Create EmoteBubble class.
- Create Workstation class.
- Create VisualEffects system.
- Use tweens for smooth tile movement.
- Use animation keys for each employee state.
- Use depth sorting by y-position so characters overlap correctly.
- Use camera pan/zoom.
- Use clickable interactive zones for rooms/employees.

React:

- Keep UI separate from Phaser.
- Selected employee/room stored in Zustand.
- Activity feed from WebSocket.
- Boss console as React panel.
- Room/employee popups as React overlays.
- Do not store simulation truth only in React.

Backend:

- Simulation state remains source of truth.
- Frontend receives state snapshots/deltas.
- Visual state derives from simulation state.
- Do not let Phaser make real decisions.

## Placeholder Art Rule

If no real sprites exist yet, create simple but character-like placeholders:

- Head
- Body
- Legs
- Directional facing
- Department accent color
- Small walk bob animation

Do not use circles/dots.

Character placeholder example description:

A small 32x48 top-down worker sprite with:

- Rounded head
- Small torso
- Clean-room outfit
- Department color stripe
- Two-frame walking leg motion
- Face direction changes
- Small shadow under feet

## Final Visual Design Principle

NeuroLab should feel like:

"a tiny living clean-room facility where every computer event becomes a visible story."

Not:

"a monitoring dashboard with dots moving around."
