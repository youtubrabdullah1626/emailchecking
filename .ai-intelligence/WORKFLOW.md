# Standard Development Workflow

Always adhere to the following sequence for any significant task:

## 1. Research & Analysis
- **Analyze Requirements:** Read the prompt carefully. Identify implicit needs (e.g., edge cases).
- **Inspect Codebase:** Use targeted searches (`grep`, `view_file`) instead of guessing. Map out the dependencies.
- **Extract Knowledge:** If utilizing external documentation, summarize it efficiently rather than dumping large files.

## 2. Planning
- **Formulate a Plan:** Before writing code, propose an implementation plan highlighting the architecture, the specific files to modify, and how edge cases will be handled.
- **Acknowledge Risk:** Identify what could break and plan safeguards.

## 3. Implementation
- **Execute Incrementally:** Write the code step-by-step.
- **Follow Best Practices:** Adhere to `CORE_RULES.md` and load specific skills (e.g., `frontend-engineer.md`) if the task is domain-specific.
- **Avoid Unnecessary Complexity:** Implement the simplest, most readable solution that fulfills the requirements.

## 4. Testing & Verification
- **Test:** Run `npm run typecheck`, unit tests, or build commands to verify your work.
- **Review:** Perform a self-review. Did you introduce security flaws? Are there unhandled API errors?
- **Finalize:** Summarize the successful changes efficiently.
