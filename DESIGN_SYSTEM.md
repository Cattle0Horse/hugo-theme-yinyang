# YinYang Design System

## Scope

The theme uses Hugo templates for structure, CSS classes for visual contracts, and page-scoped JavaScript services for behavior. A component is complete when these three contracts are defined together.

## Tokens

Use the variables in `assets/css/variables.css` for colors, typography, spacing, control sizes, and state colors. Add a token when the same visual value belongs to more than one component. Keep component-specific geometry local to the component stylesheet.

## Template Components

`layouts/partials/action-button.html` is the shared icon-button component. It accepts `class`, `label`, `icon`, `copyIcons`, `state`, and an `attrs` map. It always emits the shared `action-button` class, accessible labeling, tooltip data, and optional state icons.

`layouts/partials/copy-icons.html` is the shared copy state icon set. Copy controls use the `copy-button` class and the `state-button` class when they need success and error transitions.

`layouts/_markup/render-table.html` and `layouts/_markup/render-codeblock.html` are content render components. They compose the shared button partial instead of defining button markup independently.

## Visual Contracts

- `.action-button` provides the stable control size, press scale, cursor, and focus interaction.
- `.action-icon` provides the icon box size and SVG stroke treatment.
- `.state-button` crossfades `default`, `success`, and `error` icons through `data-state`.
- `.copy-button` provides the shared copy-button typography, color, background, border, radius, padding, and hover transition.
- Feature classes such as `.table-copy-btn` and `.code-copy-btn` only add placement or feature-specific visibility rules.
- Tables and code blocks share the floating action reveal in `actions.css`. The content surface supplies the background color for the local fade. The overlay stays out of the layout and appears on hover, keyboard focus, or tap.

## Behavior Services

`assets/js/copy.js` owns clipboard access, fallback copying, labels, feedback, timers, and cleanup. Feature modules only locate their controls and provide the text to copy.

`assets/js/tables.js` serializes a table to Markdown with a header row, alignment delimiter row, escaped pipe characters, and body rows. `assets/js/code-toolbar.js` supplies code text. `assets/js/markdown-actions.js` supplies raw Markdown.

Runtime feature order follows service dependencies. `copy` initializes before `tables`, `markdown-actions`, and `code-toolbar` because those features consume `runtime.bindCopyButton`.

## Extension Rules

1. Reuse `action-button.html` for icon buttons.
2. Reuse `copy-button` and `copy.js` for copy interactions.
3. Add feature CSS only for placement, layout, or visibility.
4. Add a runtime test for the behavior contract and a render test for the markup contract.
5. Keep user-visible text in the component caller so labels remain page-specific and translatable.
