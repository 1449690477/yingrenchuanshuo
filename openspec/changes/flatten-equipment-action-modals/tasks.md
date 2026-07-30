## 1. Component contract

- [x] 1.1 Change `EquipDetail` to emit reforge/advancement requests by UID and remove nested operation panel ownership
- [x] 1.2 Add initial equipment UID support to `ReforgeStudio` while preserving recommendation synchronization and pending candidates
- [x] 1.3 Remove the duplicate legacy `ReforgePanel` component and its obsolete source-level UI contract

## 2. Page-level handoff

- [x] 2.1 Make BagView close detail before opening the single-layer reforge studio or advancement panel
- [x] 2.2 Make GrowthView close detail before opening its existing reforge studio or a page-owned advancement panel
- [x] 2.3 Make IdleView close detail before opening a single-layer reforge studio or advancement panel
- [x] 2.4 Keep dungeon reward equipment detail inspectable without reforge/advancement deep links

## 3. Tests and mobile acceptance

- [x] 3.1 Update component contract tests for emitted UID handoff, studio initialization, no nested operation imports, and reward restrictions
- [x] 3.2 Verify one-dialog ownership, focus/close behavior, 44px targets, and no horizontal overflow at 390×844 and 320px

## 4. Documentation and verification

- [x] 4.1 Update wash/reforge audit documentation, ROADMAP/PROGRESS, and AGENTS snapshot without changing SAVE_VERSION
- [x] 4.2 Run OpenSpec strict validation, npm run verify, npm run sim, and npm run build
- [x] 4.3 Review the final diff, commit the isolated branch, and report the delivery state
