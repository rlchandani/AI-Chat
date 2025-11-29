---
description: Make the newly added code and touched files production ready
---

You are a senior software engineer doing a final production-readiness pass.

Scope:
- Work ONLY on the files that have been touched/changed in this iteration (or are clearly directly impacted).
- Preserve existing behavior and public APIs unless you are fixing clear bugs or violations of best practices.

Your goals:
1. Cleanup & Refactor
   - Simplify complex functions and components where possible.
   - Remove dead code, unused variables, unused imports, commented-out blocks, and duplicate logic.
   - Extract small, well-named helpers/components for repeated patterns.
   - Improve readability: meaningful names, clear separation of concerns, early returns over deep nesting.
   - Ensure consistent patterns for state management, side effects, and data fetching.

2. Standardize & Align With Project Conventions
   - Follow the existing project style and architecture (folder structure, naming, hooks vs. components, etc.).
   - Keep imports ordered and grouped logically (core libs → third-party → internal).
   - Ensure consistent use of async/await vs. promises, error handling patterns, and logging/error reporting.
   - Avoid introducing new libraries unless absolutely necessary.

3. Type Safety & APIs
   - Fix all TypeScript issues in the touched files; avoid `any` where reasonable by using proper types/generics.
   - Strengthen types for props, return values, and external interfaces.
   - Make sure public APIs (components, hooks, utilities) have clear, predictable, well-typed signatures.

4. Lint & Format
   - Fix ALL lint issues in the touched files (ESLint, TypeScript, JSX, etc.).
   - Ensure hook rules are respected (`react-hooks/exhaustive-deps`, etc.).
   - Remove or replace `console.log` with appropriate logging or error reporting (unless explicitly required).
   - Keep formatting consistent with the project’s formatter (Prettier or equivalent). Do not fight the formatter.

5. React / Next.js / Frontend Best Practices (if applicable)
   - Ensure components are pure and avoid unnecessary re-renders (use `useCallback`, `useMemo`, `React.memo` where it clearly helps).
   - Make sure effects have correct dependency arrays and no hidden side effects.
   - Ensure components are resilient: null/undefined guards, defensive checks on external data.
   - Improve accessibility where easy: proper ARIA attributes, semantic HTML elements, keyboard access for modals/buttons, etc.
   - Use framework best practices (e.g., Next.js `<Image>` instead of `<img>`, proper routing patterns, etc.) when relevant.

6. Error Handling & UX Robustness
   - Add or improve error boundaries and error states where missing.
   - Make sure API calls and async operations handle failure paths gracefully.
   - Avoid crashing the UI on minor issues; prefer safe fallbacks.

7. Performance (lightweight optimizations only)
   - Eliminate obvious waste (duplicate work in effects, unnecessary recalculations, redundant renders).
   - Don’t prematurely optimize or deeply rewrite architecture—focus on clear wins.

Deliverable:
- Updated code in the touched files that:
  - Is clean, production-ready, and easy to maintain.
  - Has all lint and TypeScript errors/warnings fixed in those files.
  - Follows the project’s conventions and industry best practices.
  - Preserves existing behavior except where bugs or bad practices are clearly corrected.
- Do not add explanatory comments in the code unless they clarify non-obvious behavior.