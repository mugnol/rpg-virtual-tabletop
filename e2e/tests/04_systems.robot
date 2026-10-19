*** Settings ***
Documentation    UC-13..UC-16: browse, export, and GM-only import of RPG system configurations.
Resource         ../resources/common.resource
Suite Setup      Initialize Suite
Suite Teardown   Close Browser
Test Setup       New Context
Test Teardown    Close Context

*** Test Cases ***
Logged-in users can browse built-in systems with legal attribution and export
    Register Via UI    sys-browse-${TS}@e2e.test    player    System Browser
    Go To    /systems
    TestID Should Be Visible    page-systems
    TestID Should Be Visible    system-list
    TestID Text Should Contain    system-list    Shadowdark RPG
    TestID Text Should Contain    system-list    Dungeons & Dragons 5e (2024)
    TestID Text Should Contain    page-systems    The Arcane Library
    TestID Text Should Contain    page-systems    System Reference Document 5.2.1
    Get Element Count    css=[data-testid="system-export-button"]    >=    2

Players do not see the system import form
    Register Via UI    sys-player-${TS}@e2e.test    player    Plain Player
    Go To    /systems
    TestID Should Be Visible    page-systems
    TestID Should Not Be Visible    system-import-form

GM imports a valid custom system configuration and sees it listed
    Register Via UI    sys-gm-${TS}@e2e.test    gm    System Architect
    Go To    /systems
    TestID Should Be Visible    system-import-form
    ${custom_json}=    Set Variable    {"key":"custom-${TS}","name":"Custom OSR ${TS}","version":"1.0.0","attribution":"Custom OSR mechanics licensed under CC-BY-4.0 for testing.","abilities":[{"key":"str","name":"Strength","abbreviation":"STR"},{"key":"dex","name":"Dexterity","abbreviation":"DEX"},{"key":"con","name":"Constitution","abbreviation":"CON"}],"abilityScoreRange":{"min":3,"max":18},"abilityModifier":{"formula":"floor((score - 10) / 2)"},"creation":{"methods":["manual","roll3d6InOrder"]},"levels":{"max":5,"advancement":{"mode":"multiplier","xpMultiplier":10,"resetOnAdvance":true}},"classes":[{"key":"warrior","name":"Warrior","hitDie":8}],"ancestries":[{"key":"human","name":"Human"}],"backgrounds":[{"key":"wanderer","name":"Wanderer"}],"armor":[{"key":"leather","name":"Leather","base":11,"dex":"full"}],"shield":{"bonus":2},"derived":{"hitPointsAtFirstLevel":"class.hitDie + con.mod","hitPointsPerLevel":"floor(class.hitDie / 2) + 1","initiative":"dex.mod"},"currency":{"units":["gp"]},"extras":{"talents":true,"spells":false,"notes":true}}
    Fill TestID    system-import-input    ${custom_json}
    Click TestID    system-import-submit
    TestID Text Should Contain    system-list    Custom OSR ${TS}

GM receives validation errors when importing malformed or invalid system JSON
    Register Via UI    sys-bad-gm-${TS}@e2e.test    gm    Bad Config GM
    Go To    /systems
    Fill TestID    system-import-input    {not valid json
    Click TestID    system-import-submit
    TestID Should Be Visible    form-error
    Fill TestID    system-import-input    {"key":"invalid","name":"Invalid"}
    Click TestID    system-import-submit
    TestID Should Be Visible    form-error
