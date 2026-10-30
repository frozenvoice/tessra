# Tessra 1.2.1

## Narrow Request panel More menu fix

On a narrow Request Webview (for example with a wide Tessra sidebar), the Request More (`...`) control could drop alone onto the next line on the left, and its menu could open outside the Webview so items were clipped and hard to use.

1.2.1 keeps Method → URL → Send → More grouped, and opens Request/Response More menus with viewport-safe placement so the full menu stays inside the panel and remains clickable.

No Path Variables, Environment, Runner, or request execution behavior changes.
