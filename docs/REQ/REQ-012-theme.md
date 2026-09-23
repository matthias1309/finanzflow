# REQ-012 — Dark / Light Theme

## User Story

As a user,  
I want to switch between a dark and a light color theme,  
so that the application is comfortable to use in different lighting conditions and matches my system preferences.

## Background

FinanzFlow supports two visual themes: dark and light. The initial theme is determined by the operating system's `prefers-color-scheme` media query. The user can toggle the theme using a button in the sidebar footer. The selected theme affects all UI components including the Sankey chart, which uses different color palettes for each theme.

## Acceptance Criteria

```gherkin
Feature: Dark / Light Theme Toggle

  Scenario: App starts in dark mode on a system set to dark
    Given the operating system is configured to prefer dark mode
    When the user opens FinanzFlow
    Then the application loads in dark mode
    And the background is very dark navy (#1c1e26 approximately)

  Scenario: App starts in light mode on a system set to light
    Given the operating system is configured to prefer light mode
    When the user opens FinanzFlow
    Then the application loads in light mode
    And the background is light gray (#f4f6f9 approximately)

  Scenario: User toggles from dark to light mode
    Given the application is in dark mode
    When the user clicks the "Light-Modus" button in the sidebar footer
    Then the application switches to light mode
    And the button label changes to "Dark-Modus"
    And the Sun icon is replaced by the Moon icon

  Scenario: User toggles from light to dark mode
    Given the application is in light mode
    When the user clicks the "Dark-Modus" button in the sidebar footer
    Then the application switches to dark mode

  Scenario: Sankey chart adapts to theme
    Given the application is in dark mode
    Then the Sankey income flows are rendered in #6daa45
    And expense flows are rendered in #f87171
    And node labels are #c9c8c6
    When the user switches to light mode
    Then income flows change to #15803d
    And expense flows change to #dc2626
    And node labels change to #374151
```

## Notes

- Theme state is stored in React component state and is not persisted to localStorage or the server. Reloading the page resets to the system preference.
- Theme is applied by toggling the `dark` class on `document.documentElement`. Tailwind CSS's dark mode uses this class to switch between the `:root` and `.dark` CSS variable sets.
- The theme toggle button is always visible in the sidebar footer, regardless of which page is active.
