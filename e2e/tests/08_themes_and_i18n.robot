*** Settings ***
Documentation    UC-46..UC-56: Dynamic visual theme switching, JSON theme import/export, and multi-language support (en & pt-BR).
Resource         ../resources/common.resource
Suite Setup      Initialize Suite
Suite Teardown   Close Browser
Test Setup       New Context
Test Teardown    Close Context

*** Test Cases ***
Switching theme applies data-theme attribute and visual styling in real time
    Register Via UI    theme-switch-${TS}@e2e.test    player    Theme Tester
    Go To    ${HOME}

    # Verify default medieval theme
    Get Attribute    css=html    data-theme    ==    medieval
    TestID Should Be Visible    theme-select

    # Switch to Cyberpunk theme
    Select Options By    css=[data-testid="theme-select"]    value    cyberpunk
    Get Attribute    css=html    data-theme    ==    cyberpunk

    # Switch back to Medieval
    Select Options By    css=[data-testid="theme-select"]    value    medieval
    Get Attribute    css=html    data-theme    ==    medieval

Theme export and custom JSON import
    Register Via UI    theme-importer-${TS}@e2e.test    gm    Theme Importer
    Go To    /themes
    TestID Should Be Visible    page-themes

    # Verify export button for built-in cyberpunk theme
    TestID Should Be Visible    theme-card-cyberpunk
    Get Element    css=[data-testid="theme-card-cyberpunk"] [data-testid="theme-export-button"]

    # Attempt to import invalid theme JSON
    TestID Should Be Visible    theme-import-input
    Fill TestID    theme-import-input    {"invalid": "json theme"}
    Click TestID    theme-import-submit
    TestID Should Be Visible    form-error

    # Import valid custom theme JSON
    ${synth_json}=    Set Variable    {"key":"neon-synth-${TS}","name":"Neon Synth ${TS}","description":"Retro synthwave theme","colors":{"bgPrimary":"#120224","bgSecondary":"#220642","bgPanel":"#300a5c","textPrimary":"#f9e4fc","textSecondary":"#bf90d6","accent":"#ff007f","accentHover":"#ff3399","border":"#611494","danger":"#ff0033"},"typography":{"fontFamilySans":"system-ui, sans-serif","fontFamilyHeading":"sans-serif","fontFamilyMono":"monospace"},"borderRadius":"8px"}
    Fill TestID    theme-import-input    ${synth_json}
    Click TestID    theme-import-submit

    # Custom theme appears in theme list and header selector
    TestID Should Be Visible    theme-card-neon-synth-${TS}
    Select Options By    css=[data-testid="theme-select"]    value    neon-synth-${TS}
    Get Attribute    css=html    data-theme    ==    neon-synth-${TS}

Switching language dynamically translates UI and switches back
    Register Via UI    i18n-switch-${TS}@e2e.test    gm    Polyglot User
    Go To    ${HOME}

    # Default is English
    TestID Should Be Visible    locale-select
    Get Text    css=[data-testid="nav-dashboard-link"]    ==    Dashboard
    Get Text    css=[data-testid="create-campaign-button"]    ==    Create Campaign

    # Switch to Brazilian Portuguese
    Select Options By    css=[data-testid="locale-select"]    value    pt-BR
    Get Text    css=[data-testid="nav-dashboard-link"]    ==    Painel
    Get Text    css=[data-testid="create-campaign-button"]    ==    Criar Campanha

    # Switch back to English
    Select Options By    css=[data-testid="locale-select"]    value    en
    Get Text    css=[data-testid="nav-dashboard-link"]    ==    Dashboard
    Get Text    css=[data-testid="create-campaign-button"]    ==    Create Campaign

Per-user persistence of theme and locale across sessions
    # User A registers, selects cyberpunk and pt-BR
    Register Via UI    user-a-${TS}@e2e.test    player    User A
    Go To    ${HOME}
    Select Options By    css=[data-testid="theme-select"]    value    cyberpunk
    Select Options By    css=[data-testid="locale-select"]    value    pt-BR
    Get Attribute    css=html    data-theme    ==    cyberpunk
    Get Text    css=[data-testid="nav-dashboard-link"]    ==    Painel
    Logout Via UI

    # User B logs in, sees default medieval theme and en locale
    New Context
    Register Via UI    user-b-${TS}@e2e.test    player    User B
    Go To    ${HOME}
    Get Attribute    css=html    data-theme    ==    medieval
    Get Text    css=[data-testid="nav-dashboard-link"]    ==    Dashboard
    Logout Via UI

    # User A logs back in, cyberpunk and pt-BR are restored
    New Context
    Login Via UI    user-a-${TS}@e2e.test
    Go To    ${HOME}
    Get Attribute    css=html    data-theme    ==    cyberpunk
    Get Text    css=[data-testid="nav-dashboard-link"]    ==    Painel
