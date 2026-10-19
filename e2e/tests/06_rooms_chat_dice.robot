*** Settings ***
Documentation    UC-26..UC-32: Game Rooms (Sessions), real-time presence, moderated chat, and shared animated dice roller.
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
GM creates a session room, controls lifecycle, and players see presence and status
    Register Via UI    room-gm-${TS}@e2e.test    gm    Dungeon Master
    Create System Campaign Via UI    Sunken Citadel    shadowdark
    Click TestID    session-create-button
    Fill TestID    session-name-input    Session 1: Into the Ruins
    Click TestID    session-create-submit
    TestID Should Be Visible    session-item
    TestID Text Should Contain    session-item    Session 1: Into the Ruins
    TestID Text Should Contain    session-status-badge    SCHEDULED

    # Open session room
    Click    css=[data-testid="session-item"]:has-text("Session 1: Into the Ruins")
    TestID Should Be Visible    page-session
    TestID Text Should Be    session-title    Session 1: Into the Ruins
    TestID Text Should Contain    session-status    SCHEDULED

    # GM starts session
    Click TestID    session-start-button
    TestID Text Should Contain    session-status    ACTIVE

    # Check GM presence
    TestID Text Should Contain    presence-list    Dungeon Master

Real-time chat and GM message moderation
    Register Via UI    chat-gm-${TS}@e2e.test    gm    Chat GM
    Create System Campaign Via UI    Chat Haven    shadowdark
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]
    Click TestID    session-create-button
    Fill TestID    session-name-input    Live Chat Room
    Click TestID    session-create-submit
    Click    css=[data-testid="session-item"]:has-text("Live Chat Room")
    Click TestID    session-start-button

    # Player joins
    New Context
    Register Via UI    chat-p-${TS}@e2e.test    player    Chatty Player
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    Click    css=[data-testid="session-item"]:has-text("Live Chat Room")
    TestID Should Be Visible    page-session
    TestID Text Should Contain    presence-list    Chatty Player

    # Player sends a message
    Fill TestID    chat-input    Hello adventure party!
    Click TestID    chat-send-button
    TestID Text Should Contain    chat-stream    Hello adventure party!

    # Player sends accidental message, GM deletes it
    Fill TestID    chat-input    Accidental secret
    Click TestID    chat-send-button
    TestID Text Should Contain    chat-stream    Accidental secret

    # Switch to GM context to delete
    New Context
    Login Via UI    chat-gm-${TS}@e2e.test
    Click Campaign Named    Chat Haven
    Click    css=[data-testid="session-item"]:has-text("Live Chat Room")
    Click    css=[data-testid="chat-message"]:has-text("Accidental secret") [data-testid="chat-delete-button"]
    Wait For Elements State    css=[data-testid="chat-content"]:has-text("Accidental secret")    hidden

Shared interactive dice roller tray and roll broadcast
    Register Via UI    dice-gm-${TS}@e2e.test    gm    Rolling GM
    Create System Campaign Via UI    Rolling Castle    shadowdark
    Click TestID    session-create-button
    Fill TestID    session-name-input    Dice Arena
    Click TestID    session-create-submit
    Click    css=[data-testid="session-item"]:has-text("Dice Arena")
    Click TestID    session-start-button

    # Click d20 button on tray
    Click TestID    dice-button-20
    Fill TestID    dice-modifier-input    5
    Click TestID    dice-roll-button

    # Animation overlay triggers and result appears in chat
    TestID Should Be Visible    dice-animation-overlay
    TestID Should Be Visible    dice-roll-breakdown
    TestID Text Should Contain    chat-stream    d20+5
