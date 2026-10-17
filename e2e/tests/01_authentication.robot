*** Settings ***
Documentation    UC-01..UC-04: registration, login, logout, session protection.
Resource         ../resources/common.resource
Suite Setup      Initialize Suite
Suite Teardown   Close Browser
Test Setup       New Context
Test Teardown    Close Context

*** Test Cases ***
Register as GM lands on the dashboard with role shown
    Register Via UI    gm-${TS}@e2e.test    gm    Elminster
    TestID Should Be Visible    nav-user
    TestID Text Should Contain    nav-user    Elminster
    TestID Text Should Contain    nav-user    GM
    TestID Should Be Visible    empty-campaigns

Register as Player lands on the dashboard without campaign creation
    Register Via UI    player-${TS}@e2e.test    player    Drizzt
    TestID Text Should Contain    nav-user    Drizzt (PLAYER)
    TestID Should Not Be Visible    create-campaign-button
    TestID Should Be Visible    join-form

Registration rejects invalid input and stays on the form
    Open App At    /register
    Fill TestID    email-input    not-an-email
    Fill TestID    display-name-input    x
    Fill TestID    password-input    short
    Click TestID    role-gm
    Click TestID    register-submit
    TestID Should Be Visible    page-register
    TestID Should Be Visible    form-error

Registration rejects a duplicate email
    Register Via UI    dupe-${TS}@e2e.test    gm    First
    Logout Via UI
    Open App At    /register
    Fill TestID    email-input    DUPE-${TS}@e2e.test
    Fill TestID    display-name-input    Second
    Fill TestID    password-input    password123
    Click TestID    role-gm
    Click TestID    register-submit
    TestID Should Be Visible    page-register
    Form Error Should Contain    An account with this email already exists

Login with unknown email or wrong password shows a generic error
    Register Via UI    victim-${TS}@e2e.test    player    Victim
    Logout Via UI
    Open App At    /login
    Fill TestID    email-input    ghost-${TS}@e2e.test
    Fill TestID    password-input    password123
    Click TestID    login-submit
    TestID Should Be Visible    page-login
    Form Error Should Contain    Invalid email or password
    Fill TestID    email-input    victim-${TS}@e2e.test
    Fill TestID    password-input    wrong-password
    Click TestID    login-submit
    Form Error Should Contain    Invalid email or password

Login and logout round trip
    Register Via UI    round-${TS}@e2e.test    gm    Rounder
    Logout Via UI
    Login Via UI    round-${TS}@e2e.test
    TestID Text Should Contain    nav-user    Rounder (GM)

Unauthenticated visitors are redirected to login
    Open App At    /
    TestID Should Be Visible    page-login

Session survives a page reload
    Register Via UI    persist-${TS}@e2e.test    gm    Persister
    Reload
    TestID Should Be Visible    page-dashboard
    TestID Text Should Contain    nav-user    Persister (GM)
