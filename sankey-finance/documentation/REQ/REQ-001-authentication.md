# REQ-001 — Authentication & Access Control

## User Story

As a user of FinanzFlow,  
I want the application to be protected by a password,  
so that my personal financial data cannot be accessed by anyone who opens the URL.

## Background

FinanzFlow is a personal finance tool deployed on a public URL. All routes — API and frontend — must be protected. The application uses HTTP Basic Authentication backed by a bcrypt-hashed password stored as an environment variable. In development mode without a configured password, the application allows unrestricted access so development workflows are not blocked.

## Acceptance Criteria

```gherkin
Feature: HTTP Basic Authentication

  Background:
    Given the application is running in production mode
    And APP_PASSWORD_HASH is set to a valid bcrypt hash of "secret"
    And APP_USER is set to "admin"

  Scenario: Correct credentials grant access
    When the user sends a request with Authorization header "Basic admin:secret" (base64 encoded)
    Then the response status is 200
    And the response contains the requested resource

  Scenario: Wrong password is rejected
    When the user sends a request with Authorization header for "admin" and wrong password
    Then the response status is 401
    And the response header "WWW-Authenticate" contains 'Basic realm="FinanzFlow"'

  Scenario: Missing credentials are rejected
    When the user sends a request without an Authorization header
    Then the response status is 401
    And the response header "WWW-Authenticate" is present

  Scenario: Brute-force protection locks out after repeated failures
    When the same IP sends 10 failed login attempts within 15 minutes
    Then the 11th request returns status 429
    And the response body contains "Zu viele Login-Versuche"

  Scenario: Production startup fails without password hash
    Given APP_PASSWORD_HASH is not set
    And NODE_ENV is "production"
    When the server starts
    Then the server exits with a fatal error message
    And the error message instructs how to generate a password hash

  Scenario: Development mode allows access without password
    Given APP_PASSWORD_HASH is not set
    And NODE_ENV is "development"
    When the user sends a request without credentials
    Then the response status is 200
```

## Notes

- Password comparison uses `timingSafeEqual` with fixed 256-byte buffers to prevent timing-based side-channel attacks — even when username or password lengths differ.
- The brute-force limiter only counts failed requests (`skipSuccessfulRequests: true`).
- The bcrypt cost factor is 10. Password hashes are never logged or exposed in API responses.
