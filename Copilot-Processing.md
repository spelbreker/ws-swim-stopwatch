# Copilot Processing - Responsive Design for Competition Screen

## User Request
Transform the competition screen from a fixed LED display layout to a fully responsive design that works across all devices (mobile, tablet, desktop, and LED screens ~1024x500px).

## Current State Analysis
- HTML uses `<table>` structure optimized for LED screens (~1024x500px)
- Fixed viewport height (vh) units for sizing
- 10 lanes displayed with athlete, club, split time, and arrival order
- Tailwind CSS with custom CSS variables
- WebSocket real-time updates for stopwatch, splits, and event data
- Files to modify: `public/competition/screen.html` and `public/competition/screen.js`

## Technical Requirements
1. Replace table layout with CSS Grid/Flexbox using Tailwind utilities
2. Implement responsive CSS variables with clamp() functions
3. Device-specific layouts:
   - Mobile portrait: Stack athlete/club vertically, all 10 lanes visible
   - Mobile landscape: Compact layout with optimized spacing
   - Tablet: Balanced two-column grid
   - LED/Desktop (>1024px): Maintain current behavior
4. Preserve all element IDs and JavaScript functionality
5. Maintain WebSocket update handlers
6. Ensure accessibility and touch-friendly targets

## Constraints
- No breaking changes to JavaScript selectors
- All existing tests must continue to pass
- LED screen layout must remain unchanged at large breakpoints
- Minimal modifications only

## Implementation Phases
1. Phase 1: Backup and HTML structure refactoring (table → div-based)
2. Phase 2: CSS responsive implementation with Tailwind utilities
3. Phase 3: JavaScript selector updates (if needed)
4. Phase 4: Testing and validation

## Success Criteria
- All 10 lanes visible on all device sizes
- No horizontal scroll on mobile portrait
- All WebSocket functionality working
- LED screen behavior preserved
- Smooth 60fps animations
- Touch targets ≥44x44px on mobile
