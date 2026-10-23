*** Settings ***
Documentation    UC-33..UC-45: Interactive Maps, Token Placement, Movement Permissions, and Turn-Based Combat.
Resource         ../resources/common.resource
Suite Setup      Initialize Suite
Suite Teardown   Close Browser
Test Setup       New Context
Test Teardown    Close Context

*** Keywords ***
Create System Campaign Via UI
    [Arguments]    ${name}    ${system_key}
    Go To    ${HOME}
    Click TestID    create-campaign-button
    Fill TestID    campaign-name-input    ${name}
    Select Options By    css=[data-testid="system-select"]    value    ${system_key}
    Click TestID    campaign-create-submit
    TestID Should Be Visible    page-campaign-detail
    TestID Text Should Be    campaign-name    ${name}

*** Test Cases ***
GM sets up map, places tokens, and player moves character when permitted
    Register Via UI    tactical-gm-${TS}@e2e.test    gm    Tactical GM
    Create System Campaign Via UI    Dungeon Encounter    shadowdark
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]

    # Player joins campaign and creates a character
    New Context
    Register Via UI    tactical-p-${TS}@e2e.test    player    Tactical Player
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    TestID Should Be Visible    sheet-create-pc-button
    Click TestID    sheet-create-pc-button
    Fill TestID    sheet-name-input    Brave Knight
    Click TestID    sheet-save-button
    TestID Should Be Visible    page-sheet
    TestID Text Should Be    sheet-name    Brave Knight

    # Switch back to GM to create session and place tokens
    New Context
    Login Via UI    tactical-gm-${TS}@e2e.test
    Click Campaign Named    Dungeon Encounter
    Click TestID    session-create-button
    Fill TestID    session-name-input    Battle for the Keep
    Click TestID    session-create-submit
    Click    css=[data-testid="session-item"]:has-text("Battle for the Keep")
    TestID Should Be Visible    page-session
    TestID Should Be Visible    map-board

    # GM places Character token
    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    CHARACTER
    Select Options By    css=[data-testid="token-sheet-select"]    text    Brave Knight
    Click TestID    token-submit-button
    TestID Should Be Visible    map-board
    Get Element    css=[data-testid="token-name"]:has-text("Brave Knight")

    # GM places Monster token
    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    MONSTER
    Fill TestID    token-name-input    Goblin Scout
    Fill TestID    token-hp-input    10
    Fill TestID    token-ac-input    12
    Fill TestID    token-attack-bonus-input    3
    Fill TestID    token-damage-input    1d6+1
    Click TestID    token-submit-button
    Get Element    css=[data-testid="token-name"]:has-text("Goblin Scout")

    # GM places Item token
    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    ITEM
    Fill TestID    token-name-input    Gold Chest
    Click TestID    token-submit-button
    Get Element    css=[data-testid="token-name"]:has-text("Gold Chest")

    # GM enables player movement
    Click TestID    allow-movement-toggle

    # Player joins session room and moves their character token
    New Context
    Login Via UI    tactical-p-${TS}@e2e.test
    Click Campaign Named    Dungeon Encounter
    Click    css=[data-testid="session-item"]:has-text("Battle for the Keep")
    TestID Should Be Visible    map-board
    Get Element    css=[data-testid="token-name"]:has-text("Brave Knight")

    # Click player token then click empty grid cell to move
    Click    css=[data-testid="token-name"]:has-text("Brave Knight")
    Click TestID    map-cell-3-3
    Get Element    css=[data-testid="map-cell-3-3"] [data-testid="token-name"]:has-text("Brave Knight")

Turn-based combat initiative, turn cycling, attacks and HP deduction
    Register Via UI    cbt-gm-${TS}@e2e.test    gm    Combat GM
    Create System Campaign Via UI    Combat Arena    shadowdark
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]

    # Player joins and creates PC
    New Context
    Register Via UI    cbt-p-${TS}@e2e.test    player    Arena Hero
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    Click TestID    sheet-create-pc-button
    Fill TestID    sheet-name-input    Sir Galahad
    Click TestID    sheet-save-button

    # GM starts session and places combatants
    New Context
    Login Via UI    cbt-gm-${TS}@e2e.test
    Click Campaign Named    Combat Arena
    Click TestID    session-create-button
    Fill TestID    session-name-input    Arena Duel
    Click TestID    session-create-submit
    Click    css=[data-testid="session-item"]:has-text("Arena Duel")

    # Place PC and Monster
    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    CHARACTER
    Select Options By    css=[data-testid="token-sheet-select"]    text    Sir Galahad
    Click TestID    token-submit-button

    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    MONSTER
    Fill TestID    token-name-input    Cave Troll
    Fill TestID    token-hp-input    20
    Fill TestID    token-ac-input    10
    Fill TestID    token-attack-bonus-input    4
    Fill TestID    token-damage-input    1d8+2
    Click TestID    token-submit-button

    # GM initiates combat
    Click TestID    combat-start-button
    TestID Should Be Visible    combat-tracker
    TestID Should Be Visible    active-turn-indicator

    # Attacker attacks Cave Troll
    Select Options By    css=[data-testid="combat-target-select"]    text    Cave Troll
    Click TestID    combat-attack-button

    # Result appears in chat feed and target HP is updated
    TestID Text Should Contain    chat-stream    [Combat]
    TestID Should Be Visible    combat-next-button
    Click TestID    combat-next-button

    # GM ends combat
    Click TestID    combat-end-button
    Wait For Elements State    css=[data-testid="combat-tracker"]    hidden

Campaign turn queue synchronization, active player End Turn, GM Previous Turn, round timer countdowns, and turn validation
    ${gm_ctx}=    New Context
    Register Via UI    tq-gm-${TS}@e2e.test    gm    Queue GM
    Create System Campaign Via UI    Turn Queue Campaign    shadowdark
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]

    # Player joins campaign and creates PC
    ${player_ctx}=    New Context
    Register Via UI    tq-p-${TS}@e2e.test    player    Queue Player
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    Click TestID    sheet-create-pc-button
    Fill TestID    sheet-name-input    Elara
    Click TestID    sheet-save-button
    TestID Should Be Visible    page-sheet

    # GM creates session and places CHARACTER and MONSTER tokens
    Switch Context    ${gm_ctx}
    Go To    ${HOME}
    Click Campaign Named    Turn Queue Campaign
    Click TestID    session-create-button
    Fill TestID    session-name-input    Crypt Encounter
    Click TestID    session-create-submit
    Click    css=[data-testid="session-item"]:has-text("Crypt Encounter")
    TestID Should Be Visible    map-board

    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    CHARACTER
    Select Options By    css=[data-testid="token-sheet-select"]    text    Elara
    Click TestID    token-submit-button

    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    MONSTER
    Fill TestID    token-name-input    Shadow Stalker
    Fill TestID    token-hp-input    15
    Fill TestID    token-ac-input    12
    Fill TestID    token-attack-bonus-input    3
    Fill TestID    token-damage-input    1d6+1
    Click TestID    token-submit-button

    # Player opens the same session room simultaneously
    Switch Context    ${player_ctx}
    Go To    ${HOME}
    Click Campaign Named    Turn Queue Campaign
    Click    css=[data-testid="session-item"]:has-text("Crypt Encounter")
    TestID Should Be Visible    map-board

    # GM starts encounter / turn tracking
    Switch Context    ${gm_ctx}
    Click TestID    combat-start-button
    TestID Should Be Visible    combat-tracker
    TestID Should Be Visible    turn-queue-list
    TestID Text Should Be    combat-round-number    1
    TestID Text Should Contain    active-turn-indicator    Elara
    Get Element    css=[data-testid="turn-queue-item"][data-entity-type="character"]:has-text("Elara")
    Get Element    css=[data-testid="turn-queue-item"][data-entity-type="monster"]:has-text("Shadow Stalker")

    # GM adds a round timer (Torch Light, 3 rounds)
    Fill TestID    timer-name-input    Torch Light
    Select Options By    css=[data-testid="timer-category-select"]    value    light
    Fill TestID    timer-rounds-input    3
    Click TestID    timer-add-button
    Get Element    css=[data-testid="combat-timer-item"]:has-text("Torch Light")
    TestID Text Should Contain    combat-timers    3

    # Verify Player sees synchronized Turn Tracker, Turn Queue, Round 1, and End Turn button on their character's turn
    Switch Context    ${player_ctx}
    TestID Should Be Visible    combat-tracker
    TestID Should Be Visible    turn-queue-list
    TestID Text Should Be    combat-round-number    1
    TestID Text Should Contain    active-turn-indicator    Elara
    TestID Should Be Visible    combat-end-turn-button

    # Active player clicks End Turn to advance queue to Shadow Stalker
    Click TestID    combat-end-turn-button
    TestID Text Should Contain    active-turn-indicator    Shadow Stalker

    # Turn validation: Player attempts to attack out of turn and is rejected
    Click TestID    combat-attack-button
    Form Error Should Contain    It is not your turn

    # GM sees Shadow Stalker's turn and clicks Next Turn to complete full cycle -> Round 2 & timer ticks to 2
    Switch Context    ${gm_ctx}
    TestID Text Should Contain    active-turn-indicator    Shadow Stalker
    Click TestID    combat-next-button
    TestID Text Should Be    combat-round-number    2
    TestID Text Should Contain    active-turn-indicator    Elara
    Get Element    css=[data-testid="combat-timer-rounds"]:has-text("2")

    # GM clicks Previous Turn to revert back to Round 1 and Shadow Stalker's turn (timer restored to 3)
    Click TestID    combat-prev-button
    TestID Text Should Be    combat-round-number    1
    TestID Text Should Contain    active-turn-indicator    Shadow Stalker
    Get Element    css=[data-testid="combat-timer-rounds"]:has-text("3")

    # GM ends encounter
    Click TestID    combat-end-button
    Wait For Elements State    css=[data-testid="combat-tracker"]    hidden

Shadowdark initiative system, surprise toggles, grouped monster initiative, Chaos Mode, and roll initiative controls
    ${gm_ctx}=    New Context
    Register Via UI    init-gm-${TS}@e2e.test    gm    Init GM
    Create System Campaign Via UI    Initiative Campaign    shadowdark
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]

    # Player joins campaign and creates PC
    ${player_ctx}=    New Context
    Register Via UI    init-p-${TS}@e2e.test    player    Init Player
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    Click TestID    sheet-create-pc-button
    Fill TestID    sheet-name-input    Vex
    Click TestID    sheet-save-button
    TestID Should Be Visible    page-sheet

    # GM creates session and places CHARACTER and MONSTER tokens
    Switch Context    ${gm_ctx}
    Go To    ${HOME}
    Click Campaign Named    Initiative Campaign
    Click TestID    session-create-button
    Fill TestID    session-name-input    Ambush Room
    Click TestID    session-create-submit
    Click    css=[data-testid="session-item"]:has-text("Ambush Room")
    TestID Should Be Visible    map-board

    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    CHARACTER
    Select Options By    css=[data-testid="token-sheet-select"]    text    Vex
    Click TestID    token-submit-button

    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    MONSTER
    Fill TestID    token-name-input    Ambush Spider
    Fill TestID    token-hp-input    12
    Fill TestID    token-ac-input    12
    Fill TestID    token-attack-bonus-input    3
    Fill TestID    token-damage-input    1d6
    Click TestID    token-submit-button

    # GM starts combat and verifies initiative badges, surprise toggle, grouped monster toggle, and Chaos Mode toggle
    Click TestID    combat-start-button
    TestID Should Be Visible    combat-tracker
    Get Element    css=[data-testid="turn-queue-initiative"] >> nth=0
    TestID Should Be Visible    roll-initiative-button
    TestID Should Be Visible    chaos-mode-toggle
    TestID Should Be Visible    group-monster-initiative-toggle

    # Toggle Chaos Mode & Grouped Monster Initiative
    Click TestID    chaos-mode-toggle
    Click TestID    group-monster-initiative-toggle

    # Click Roll Initiative button and verify chat log entry
    Click TestID    roll-initiative-button
    TestID Text Should Contain    chat-stream    Initiative

    # Player context also sees Roll Initiative button for their character
    Switch Context    ${player_ctx}
    Go To    ${HOME}
    Click Campaign Named    Initiative Campaign
    Click    css=[data-testid="session-item"]:has-text("Ambush Room")
    TestID Should Be Visible    combat-tracker
    TestID Should Be Visible    roll-initiative-button
    Click TestID    roll-initiative-button
    TestID Text Should Contain    chat-stream    Vex

    # GM ends combat
    Switch Context    ${gm_ctx}
    Click TestID    combat-end-button
    Wait For Elements State    css=[data-testid="combat-tracker"]    hidden

GM manual turn queue reorganization, move up and down controls, and freeform mode
    ${gm_ctx}=    New Context
    Register Via UI    reorder-gm-${TS}@e2e.test    gm    Reorder GM
    Create System Campaign Via UI    Reorder Campaign    shadowdark
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]

    # Player joins and creates PC
    ${player_ctx}=    New Context
    Register Via UI    reorder-p-${TS}@e2e.test    player    Reorder Player
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    Click TestID    sheet-create-pc-button
    Fill TestID    sheet-name-input    Theron
    Click TestID    sheet-save-button
    TestID Should Be Visible    page-sheet

    # GM creates session and places CHARACTER and 2 MONSTER tokens
    Switch Context    ${gm_ctx}
    Go To    ${HOME}
    Click Campaign Named    Reorder Campaign
    Click TestID    session-create-button
    Fill TestID    session-name-input    Reorder Arena
    Click TestID    session-create-submit
    Click    css=[data-testid="session-item"]:has-text("Reorder Arena")
    TestID Should Be Visible    map-board

    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    CHARACTER
    Select Options By    css=[data-testid="token-sheet-select"]    text    Theron
    Click TestID    token-submit-button

    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    MONSTER
    Fill TestID    token-name-input    Minotaur
    Fill TestID    token-hp-input    30
    Fill TestID    token-ac-input    14
    Fill TestID    token-attack-bonus-input    5
    Fill TestID    token-damage-input    1d10+3
    Click TestID    token-submit-button

    Click TestID    token-add-button
    Select Options By    css=[data-testid="token-type-select"]    value    MONSTER
    Fill TestID    token-name-input    Harpy
    Fill TestID    token-hp-input    15
    Fill TestID    token-ac-input    11
    Fill TestID    token-attack-bonus-input    2
    Fill TestID    token-damage-input    1d6
    Click TestID    token-submit-button

    # GM starts combat
    Click TestID    combat-start-button
    TestID Should Be Visible    combat-tracker
    TestID Should Be Visible    freeform-mode-toggle

    # Toggle Freeform Mode
    Click TestID    freeform-mode-toggle

    # Verify GM can see move up / down buttons on turn queue items
    ${first_item}=    Get Element    css=[data-testid="turn-queue-item"]:first-child
    ${second_item}=    Get Element    css=[data-testid="turn-queue-item"]:nth-child(2)
    Get Element    css=[data-testid^="turn-queue-move-down-"] >> nth=0
    Get Element    css=[data-testid^="turn-queue-move-up-"] >> nth=0

    # Player views same room
    Switch Context    ${player_ctx}
    Go To    ${HOME}
    Click Campaign Named    Reorder Campaign
    Click    css=[data-testid="session-item"]:has-text("Reorder Arena")
    TestID Should Be Visible    combat-tracker
    # Player should NOT see move up or move down buttons
    Wait For Elements State    css=[data-testid^="turn-queue-move-up-"]    hidden
    Wait For Elements State    css=[data-testid^="turn-queue-move-down-"]    hidden

    # GM ends combat
    Switch Context    ${gm_ctx}
    Click TestID    combat-end-button
    Wait For Elements State    css=[data-testid="combat-tracker"]    hidden
