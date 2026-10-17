*** Settings ***
Documentation    UC-05..UC-10: campaign CRUD by GMs; player view restrictions.
Resource         ../resources/common.resource
Suite Setup      Initialize Suite
Suite Teardown   Close Browser
Test Setup       New Context
Test Teardown    Close Context

*** Test Cases ***
GM creates a campaign with defaults and sees it on the dashboard
    Register Via UI    crud-gm-${TS}@e2e.test    gm    Crud Master
    Create Campaign Via UI    Curse of Strahd
    TestID Text Should Contain    member-list    Crud Master
    TestID Text Should Contain    member-list    OWNER
    Go To    ${HOME}
    TestID Text Should Contain    campaign-list    Curse of Strahd

GM edits a campaign name
    Register Via UI    edit-gm-${TS}@e2e.test    gm    Edit Master
    Create Campaign Via UI    Before Edit
    Click TestID    edit-button
    Fill TestID    campaign-name-input    After Edit
    Click TestID    save-button
    TestID Text Should Be    campaign-name    After Edit
    Go To    ${HOME}
    TestID Text Should Contain    campaign-list    After Edit

GM archives and unarchives a campaign
    Register Via UI    arch-gm-${TS}@e2e.test    gm    Archive Master
    Create Campaign Via UI    Archive Me
    Click TestID    archive-button
    TestID Should Be Visible    archived-badge
    TestID Should Be Visible    unarchive-button
    Go To    ${HOME}
    TestID Text Should Contain    campaign-list    Archive Me
    Click Campaign Named    Archive Me
    TestID Should Be Visible    archived-badge
    Click TestID    unarchive-button
    TestID Should Not Be Visible    archived-badge

GM deletes a campaign after confirmation
    Register Via UI    del-gm-${TS}@e2e.test    gm    Delete Master
    Create Campaign Via UI    Doomed Campaign
    Handle Future Dialogs    action=accept
    Click TestID    delete-button
    TestID Should Be Visible    page-dashboard
    TestID Should Be Visible    empty-campaigns

Delete is cancelled when the GM dismisses the confirmation
    Register Via UI    keep-gm-${TS}@e2e.test    gm    Keep Master
    Create Campaign Via UI    Kept Campaign
    Handle Future Dialogs    action=dismiss
    Click TestID    delete-button
    TestID Should Be Visible    page-campaign-detail
    TestID Text Should Be    campaign-name    Kept Campaign

Players see no campaign creation UI
    Register Via UI    nop-create-${TS}@e2e.test    player    Plain Player
    TestID Should Not Be Visible    create-campaign-button
    TestID Should Be Visible    join-form

Members cannot edit, archive, or delete a campaign
    Register Via UI    restr-gm-${TS}@e2e.test    gm    Restr GM
    Create Campaign Via UI    Locked Campaign
    Click TestID    invite-generate-button
    ${code}=    Get Text    css=[data-testid="invite-code"]
    New Context
    Register Via UI    restr-player-${TS}@e2e.test    player    Restr Player
    Go To    ${HOME}
    Fill TestID    token-input    ${code}
    Click TestID    join-button
    TestID Should Be Visible    page-campaign-detail
    TestID Should Not Be Visible    edit-button
    TestID Should Not Be Visible    archive-button
    TestID Should Not Be Visible    delete-button
    TestID Should Not Be Visible    invite-generate-button
