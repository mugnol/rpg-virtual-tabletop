*** Settings ***
Documentation    UC-17..UC-25: system-driven character sheets (PC & NPC creation, computed stats, edit, level-up, delete).
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
Campaign without a system shows no character sheet creation buttons
    Register Via UI    nosys-gm-${TS}@e2e.test    gm    Generic GM
    Create Campaign Via UI    Generic World
    TestID Should Not Be Visible    sheet-create-pc-button
    TestID Should Not Be Visible    sheet-create-npc-button

Player creates a Shadowdark PC with rolled abilities and sees computed stats; levels up and edits
    Register Via UI    sd-gm-${TS}@e2e.test    gm    Shadow GM
    Create System Campaign Via UI    Gloomy Delve    shadowdark
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]
    New Context
    Register Via UI    sd-player-${TS}@e2e.test    player    Delver Player
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    TestID Should Be Visible    page-campaign-detail
    TestID Should Be Visible    sheet-create-pc-button
    TestID Should Not Be Visible    sheet-create-npc-button
    Click TestID    sheet-create-pc-button
    Fill TestID    sheet-name-input    Borin Ironfoot
    Click TestID    roll-abilities-button
    Select Options By    css=[data-testid="ancestry-select"]    value    dwarf
    Select Options By    css=[data-testid="class-select"]    value    fighter
    Select Options By    css=[data-testid="background-select"]    value    mercenary
    Select Options By    css=[data-testid="armor-select"]    value    chainmail
    Check Checkbox    css=[data-testid="shield-checkbox"]
    Click TestID    sheet-save-button
    TestID Should Be Visible    page-sheet
    TestID Text Should Be    sheet-name    Borin Ironfoot
    TestID Text Should Be    sheet-level    1
    TestID Should Be Visible    ac-value
    TestID Should Be Visible    hp-max
    TestID Should Be Visible    carry-value
    TestID Text Should Be    next-level-xp    10
    Click TestID    sheet-edit-button
    Fill TestID    notes-input    Carries a grappling hook.
    Click TestID    sheet-save-button
    TestID Text Should Contain    page-sheet    Carries a grappling hook.
    Click TestID    level-up-button
    TestID Text Should Be    sheet-level    2
    TestID Text Should Be    next-level-xp    20

GM creates an NPC and player cannot edit or delete it
    Register Via UI    npc-gm-${TS}@e2e.test    gm    Dungeon Master
    Create System Campaign Via UI    Dragon Keep    dnd5e-2024
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]
    TestID Should Be Visible    sheet-create-npc-button
    Click TestID    sheet-create-npc-button
    Fill TestID    sheet-name-input    Captain Vane
    Select Options By    css=[data-testid="ancestry-select"]    value    human
    Select Options By    css=[data-testid="class-select"]    value    fighter
    Select Options By    css=[data-testid="background-select"]    value    soldier
    Select Options By    css=[data-testid="armor-select"]    value    plate
    Click TestID    sheet-save-button
    TestID Should Be Visible    page-sheet
    TestID Text Should Be    sheet-name    Captain Vane
    TestID Text Should Be    ac-value    18
    TestID Text Should Be    pb-value    +2
    Go To    ${HOME}
    Click Campaign Named    Dragon Keep
    TestID Text Should Contain    sheet-list    Captain Vane
    TestID Text Should Contain    sheet-kind-badge    NPC
    New Context
    Register Via UI    npc-player-${TS}@e2e.test    player    Visiting Player
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    TestID Text Should Contain    sheet-list    Captain Vane
    Click    css=[data-testid="sheet-item"]:has-text("Captain Vane")
    TestID Should Be Visible    page-sheet
    TestID Should Not Be Visible    sheet-edit-button
    TestID Should Not Be Visible    level-up-button
    TestID Should Not Be Visible    sheet-delete-button

Player generates random Shadowdark character and imports/exports Shadowdarklings JSON
    Register Via UI    sd-full-gm-${TS}@e2e.test    gm    Shadowdark Master
    Create System Campaign Via UI    The Lost Citadel    shadowdark
    TestID Should Be Visible    generate-random-character-button
    Click TestID    generate-random-character-button
    TestID Should Be Visible    page-sheet
    TestID Should Be Visible    sheet-title
    TestID Should Be Visible    sheet-alignment
    TestID Should Be Visible    export-shadowdarklings-button
    Go To    ${HOME}
    Click Campaign Named    The Lost Citadel
    Click TestID    import-shadowdarklings-toggle
    Fill TestID    import-shadowdarklings-input    {"name":"Ralina","ancestry":"Halfling","class":"Thief","level":1,"alignment":"Neutral","background":"Urchin","deity":"Gede","title":"Robber","stats":{"STR":8,"DEX":16,"CON":12,"INT":11,"WIS":10,"CHA":14},"maxHitPoints":5,"armorClass":14,"gear":[{"name":"Leather armor","type":"armor","quantity":1,"slots":1},{"name":"Dagger","type":"weapon","quantity":1,"slots":1}],"gold":15,"silver":0,"copper":0,"talents":[{"name":"Backstab deals +1 dice of damage","source":"Class","gainedAtLevel":1}],"languages":"Common"}
    Click TestID    import-shadowdarklings-submit
    TestID Should Be Visible    page-sheet
    TestID Text Should Be    sheet-name    Ralina
    TestID Text Should Be    sheet-title    Robber
    TestID Text Should Be    sheet-alignment    Neutral
