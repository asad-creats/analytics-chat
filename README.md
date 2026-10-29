# Pipeline

AI analytics for real estate teams: ask about your leads, agents or deals in plain English, and every answer shows the numbers and the query it used.

This is the front end, built from the Pipeline design (Home, Answer, Thread, Pinned board, States, in light and dark, desktop and mobile). It runs on a fixed demo dataset and labels itself "Demo · fake data" throughout.

## Run it

```bash
npm install
npm run dev
```

`npm run build` type-checks and builds to `dist/`.

## Portfolio build

The app also runs at `/pipeline/` on the portfolio site (`asad-creats/projects`). To update it there:

```bash
npm run build:portfolio
rm -rf ../projects/public/pipeline && cp -r dist-portfolio ../projects/public/pipeline
```

Then commit and push `projects`; Vercel redeploys it from `master`.

## Pages

| Route | Screen |
| --- | --- |
| `/` | Home: question box and starter questions |
| `/ask?q=…` | Works a question out (loading steps), then opens its answer, or shows the ambiguous or can't-answer state |
| `/answer/lead-sources` | Full answer view with chart/table toggle and "How I got this" |
| `/thread/monday` | Conversation thread with bar, table and line answers |
| `/board` | Pinned "Morning board" |
| `/states` | Reference sheet of every answer state |

## Code layout

- `src/styles/tokens.css`: colour, radius, font and motion tokens from the spec sheet. Light by default; dark follows the OS, or set `data-theme="dark"` / `"light"` on `<html>`.
- `src/components/`: the component sheet as React components (`AppShell`, `Composer`, `AnswerCard` with `LinkedNumber` and "How I got this", `charts`, `BoardCard`, `AnswerStates`, `controls`). Each has a matching CSS Module.
- `src/pages/`: one file per screen.
- `src/data/demo.ts`: the demo dataset and the keyword matcher that routes typed questions.
- `src/state/`: pinned answers and toasts (React context, in memory).
