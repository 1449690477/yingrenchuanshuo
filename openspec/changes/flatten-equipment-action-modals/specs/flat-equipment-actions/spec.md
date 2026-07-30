## ADDED Requirements

### Requirement: Equipment detail does not own secondary operation dialogs
The equipment detail component SHALL request reforge or advancement actions from its page-level owner and MUST NOT render either operation dialog itself.

#### Scenario: Request reforge from equipment detail
- **WHEN** the player selects word-affix reforge on a manageable equipment detail
- **THEN** the current detail closes before a single reforge studio opens for the same equipment UID

#### Scenario: Request advancement from equipment detail
- **WHEN** the player selects cross-region advancement on a manageable equipment detail
- **THEN** the current detail closes before a single advancement panel opens for the same equipment UID

### Requirement: Reforge result remains a post-roll player decision
The reforge studio SHALL consume and persist a roll before showing its result, and SHALL keep the original affix unchanged until the player chooses whether to retain it or replace it with the candidate.

#### Scenario: Candidate is shown in the same studio
- **WHEN** a reforge, temper, inscription, or resonance roll completes
- **THEN** the same studio replaces its operation controls with an inline original-versus-candidate comparison and retain/replace actions

#### Scenario: Pending candidate survives leaving
- **WHEN** the player leaves before resolving a persisted candidate and later opens that equipment in the studio
- **THEN** the unresolved comparison is shown without generating or charging for another roll

### Requirement: Reward inspection cannot open a third dialog
Equipment details opened from an equipment-dungeon reward SHALL remain inspectable but MUST NOT expose reforge or advancement actions that create another dialog above the battle and detail layers.

#### Scenario: Inspect newly dropped equipment
- **WHEN** the player opens equipment detail from the dungeon reward panel
- **THEN** the player can inspect, compare, equip, lock, or decompose according to existing rules, but no reforge or advancement entry is rendered

### Requirement: Mobile dialog ownership is unambiguous
Page-level equipment action handoff SHALL maintain one active dialog, a unique close/back destination, and touch targets of at least 44 by 44 CSS pixels at 390×844 and 320px widths.

#### Scenario: Handoff on narrow viewport
- **WHEN** the player requests reforge or advancement from equipment detail at 320px width
- **THEN** the detail is absent, the requested operation panel has no horizontal overflow, and closing it returns to the originating page rather than another hidden dialog
