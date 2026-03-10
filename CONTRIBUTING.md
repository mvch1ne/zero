# Contributing to SprintLab

Thank you for your interest in contributing. SprintLab is a solo project born out of a personal need, and outside contributions — whether they are bug fixes, new features, documentation improvements, or simply well-written bug reports — are genuinely appreciated.

## Before You Start

- Check the [open issues](../../issues) to see if what you want to work on is already being tracked.
- For anything beyond a small bug fix, open an issue first to discuss the approach. This avoids wasted effort if the direction doesn't fit the project's goals.
- Read the [README](./README.md) to understand the architecture before making changes.

## Development Setup

### Frontend

```bash
cd frontend
npm install
npm run dev        # starts at http://localhost:5173
npm test           # run tests once
npm run test:watch # watch mode during development
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload   # starts at http://localhost:8000
python -m pytest              # run tests
```

The first backend startup downloads ONNX model weights — this can take a few minutes depending on your connection.

## How to Contribute

### Reporting a Bug

Use the **Bug Report** issue template. Include:

- What you expected to happen
- What actually happened
- Steps to reproduce (video format, browser, OS if relevant)
- Any error messages from the browser console or backend terminal

### Suggesting a Feature

Use the **Feature Request** issue template. Describe the problem you are trying to solve, not just the solution you have in mind — that context helps a lot.

### Submitting a Pull Request

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b fix/contact-detection-edge-case
   ```

2. Make your changes. If you are touching the metrics engine, add or update tests in `frontend/src/components/dashboard/__tests__/`.

3. Run the full test suite before opening the PR:
   ```bash
   cd frontend && npm test
   cd backend && python -m pytest
   ```

4. Keep commits focused and write clear commit messages. One logical change per commit is easier to review than a large sweep across unrelated files.

5. Open a pull request against `main` using the PR template. Link any related issues.

## Code Style

### TypeScript / React

- TypeScript strict mode is on. Avoid `any` — if something genuinely needs a loose type, add a comment explaining why.
- Prefer explicit return types on exported functions.
- Pure logic (math, data transformation) belongs in standalone `.ts` files, not inside React hooks or components. This keeps it testable and readable.
- Components should be focused. If a component file is getting long, that's usually a sign that some logic can be extracted into a hook or helper.

### Python

- Follow PEP 8.
- Keep `server.py` thin — it's a transport layer. If substantial new logic is needed, add a separate module.
- Any new endpoint should have a corresponding test in `backend/tests/`.

### Testing

- New pure math functions in `sprintMath.ts` must have unit tests.
- New backend endpoints must have at least a smoke test in `test_server.py`.
- Tests should not require a GPU, a camera, or network access. Use stubs and fixtures.

## What Not to Do

- Don't commit binary files (videos, model weights, images) to the repository.
- Don't include personal data (video footage of real people) in tests — use generated/synthetic data.
- Don't change formatting across large parts of the codebase in a single PR — it makes reviews very hard to follow.

## Questions

If you are unsure about anything, open a discussion or ask in the relevant issue. There are no stupid questions here.
