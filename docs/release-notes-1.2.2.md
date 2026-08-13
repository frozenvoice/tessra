# Tessra 1.2.2

## Path Variable URL warnings and Body scroll

1.2.2 fixes two UI regressions found while using 1.2.1.

When a Path Variable has a Request-local value, Send already resolved that path segment. The URL editor could still draw a red underline and the variable popover could say the key was missing from the Environment. Warnings now follow occurrence-level resolution: the path token is treated as resolved from the request, while the same name in query, headers, body, or auth stays unresolved unless Environment can fill it.

Long JSON / XML / Raw Body payloads could show a ghost scrollbar or two vertical scrollbars, especially on shorter windows. Text Body modes now keep a single scroll owner on the textarea. Form Data and Binary keep their existing panel scrolling.

No Path Variables execution contract, Environment, Runner, or request schema changes.
