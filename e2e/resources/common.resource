*** Settings ***
Documentation    Shared keywords and variables for the VTT E2E suite.
...              Selectors are bound to the data-testid contract from
...              docs/specs/technical/02-api-and-data-model.md §8.
Library          Browser

*** Variables ***
${BASE_URL}    %{BASE_URL=http://localhost:3100}
${HOME}        ${BASE_URL}/
${TS}          0

*** Keywords ***
Initialize Suite
    ${ts}=    Get Time    epoch
    Set Suite Variable    ${TS}    ${ts}
    New Browser    chromium    headless=True

Open App At
    [Documentation]    Open a fresh page at a path (use at the start of a test).
    [Arguments]    ${path}
    New Page    ${BASE_URL}${path}

Go To
    [Documentation]    Same as Browser's Go To, but also accepts paths relative
    ...              to ${BASE_URL} (e.g. "Go To    /login").
    [Arguments]    ${url}
    IF    $url.startswith('/')
        Browser.Go To    ${BASE_URL}${url}
    ELSE
        Browser.Go To    ${url}
    END

Click TestID
    [Arguments]    ${testid}    ${title}=
    IF    "${title}" == ""
        Click    css=[data-testid="${testid}"]
    ELSE
        Click    css=[data-testid="${testid}"]:has-text("${title}")
    END

Fill TestID
    [Arguments]    ${testid}    ${value}
    Fill Text    css=[data-testid="${testid}"]    ${value}

TestID Should Be Visible
    [Arguments]    ${testid}
    Get Element    css=[data-testid="${testid}"]

TestID Should Not Be Visible
    [Arguments]    ${testid}
    Wait For Elements State    css=[data-testid="${testid}"]    hidden

TestID Text Should Be
    [Arguments]    ${testid}    ${expected}
    ${text}=    Get Text    css=[data-testid="${testid}"]
    Should Be Equal As Strings    ${text}    ${expected}

TestID Text Should Contain
    [Arguments]    ${testid}    ${expected}
    ${text}=    Get Text    css=[data-testid="${testid}"]
    Should Contain    ${text}    ${expected}

Form Error Should Contain
    [Arguments]    ${expected}
    TestID Text Should Contain    form-error    ${expected}

Click Campaign Named
    [Documentation]    Click the campaign item whose text contains the given name.
    [Arguments]    ${name}
    Click    css=[data-testid="campaign-item"]:has-text("${name}")

Register Via UI
    [Documentation]    Register a new account; ends on the dashboard.
    [Arguments]    ${email}    ${role}    ${display_name}
    Open App At    /register
    Fill TestID    email-input    ${email}
    Fill TestID    display-name-input    ${display_name}
    Fill TestID    password-input    password123
    Click TestID    role-${role}
    Click TestID    register-submit
    TestID Should Be Visible    page-dashboard

Login Via UI
    [Documentation]    Log in; ends on the dashboard.
    [Arguments]    ${email}
    Open App At    /login
    Fill TestID    email-input    ${email}
    Fill TestID    password-input    password123
    Click TestID    login-submit
    TestID Should Be Visible    page-dashboard

Logout Via UI
    Click TestID    logout-button
    TestID Should Be Visible    page-login

Create Campaign Via UI
    [Documentation]    From the dashboard, create a campaign; ends on its detail page.
    [Arguments]    ${name}
    Go To    ${HOME}
    Click TestID    create-campaign-button
    Fill TestID    campaign-name-input    ${name}
    Click TestID    campaign-create-submit
    TestID Should Be Visible    page-campaign-detail
    TestID Text Should Be    campaign-name    ${name}
