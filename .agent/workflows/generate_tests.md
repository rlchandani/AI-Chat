---
description: Scans the codebase to identify features and generates comprehensive regression tests
---

You are a Principal QA Automation Engineer. Your goal is to create a safety net for future refactoring by writing high-value tests.

**Step 1: Environmental Scan**
1.  Read `package.json` to identify the testing framework (Jest, Vitest, Playwright, Cypress).
    * *If none exists, ask the user which one to install and stop.*
2.  Scan the directory structure to identify the architecture (e.g., Next.js App Router, Standard React, backend API).

**Step 2: Feature Discovery**
Analyze the code in `src/` (specifically looking at `routes`, `pages`, or `controllers`) to identify the **Top 5 Critical User Flows**.
* *Criteria:* Look for complex logic, data mutation (POST/PUT), or critical views (Dashboard, Checkout).

**Step 3: Test Plan Proposal**
Create a bulleted list of the identified features and the specific test scenarios you intend to write for them.
* *Example:* "Feature: Login. Scenarios: Success, Invalid Password, Rate Limited."
* **PAUSE** and ask the user to confirm this list before writing code.

**Step 4: Implementation**
Once confirmed, generate the test files.
* **Location:** Place tests alongside source files (e.g., `feature.test.ts`) or in a dedicated `__tests__` directory, matching the project structure.
* **Style:** Use Arrange-Act-Assert.
* **Mocking:** Mock external API calls (using `msw` or `jest.mock`) to ensure tests are deterministic.
* **Type Safety:** Ensure test code is fully typed.

**Step 5: Verification**
After generating the code, output the command to run these specific tests.