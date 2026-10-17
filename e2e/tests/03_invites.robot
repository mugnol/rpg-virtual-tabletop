*** Settings ***
Documentation    UC-11..UC-12: invite codes and joining campaigns.
Resource         ../resources/common.resource
Suite Setup      Initialize Suite
Suite Teardown   Close Browser
Test Setup       New Context
Test Teardown    Close Context

*** Test Cases ***
GM generates an invite code and a player joins with it
    Register Via UI    inv-gm-${TS}@e2e.test    gm    Inviting GM
    Create Campaign Via UI    Fellowship
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]
    Should Match Regexp    ${code}    ^[A-Za-z0-9_-]{24}$
    New Context
    Register Via UI    inv-player-${TS}@e2e.test    player    Invited Player
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    TestID Should Be Visible    page-campaign-detail
    TestID Text Should Be    campaign-name    Fellowship
    TestID Text Should Contain    member-list    Inviting GM
    TestID Text Should Contain    member-list    OWNER
    TestID Text Should Contain    member-list    Invited Player
    TestID Text Should Contain    member-list    PLAYER
    Go To    ${HOME}
    TestID Text Should Contain    campaign-list    Fellowship

Joining shows the invalid-code error for unknown codes
    Register Via UI    badcode-player-${TS}@e2e.test    player    Bad Coder
    Go To    ${HOME}
    Fill TestID    token-input    000000000000000000000000
    Click TestID    join-button
    TestID Should Be Visible    page-dashboard
    Form Error Should Contain    Invalid invite code

A used invite code cannot be redeemed again
    Register Via UI    reuse-gm-${TS}@e2e.test    gm    Reuse GM
    Create Campaign Via UI    Single Seat
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]
    New Context
    Register Via UI    reuse-player1-${TS}@e2e.test    player    First Seat
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    TestID Should Be Visible    page-campaign-detail
    New Context
    Register Via UI    reuse-player2-${TS}@e2e.test    player    Second Seat
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    TestID Should Be Visible    page-dashboard
    Form Error Should Contain    expired or already been used

A member joining again sees the already-member message
    Register Via UI    dup-gm-${TS}@e2e.test    gm    Dup GM
    Create Campaign Via UI    Double Trouble
    Click TestID    invite-generate-button
    ${first}=    Get Text    css=[data-testid="invite-code"]
    New Context
    Register Via UI    dup-player-${TS}@e2e.test    player    Duper
    Go To    ${HOME}
    Fill TestID    token-input    ${first}
    Click TestID    join-button
    TestID Should Be Visible    page-campaign-detail
    New Context
    Register Via UI    dup-gm2-${TS}@e2e.test    gm    Dup GM Two
    Go To    /login
    Fill TestID    email-input    dup-gm-${TS}@e2e.test
    Fill TestID    password-input    password123
    Click TestID    login-submit
    Go To    ${HOME}
    TestID Text Should Contain    campaign-list    Double Trouble
    Click TestID    campaign-item    title=Double Trouble
    Click TestID    invite-generate-button
    ${second}=    Get Text    css=[data-testid="invite-code"]
    New Context
    Login Via UI    dup-player-${TS}@e2e.test
    Go To    ${HOME}
    Fill TestID    token-input    ${second}
    Click TestID    join-button
    TestID Should Be Visible    page-dashboard
    Form Error Should Contain    already a member
