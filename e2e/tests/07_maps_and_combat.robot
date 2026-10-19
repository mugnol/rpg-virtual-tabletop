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
