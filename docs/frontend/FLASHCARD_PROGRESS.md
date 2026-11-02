# SCRUM-76 — Flashcard lesson data and progress

## Data source and mapper

Production loads `GET /api/lessons/{lessonId}` through `AppApi`, using the authenticated
API client. The route value is used as-is; the response `lessonId` must match it.
`wwwroot/js/flashcard-data.js` maps `LessonDetailResponseDto` JSON into view models.
It keeps stable content IDs, text, optional pronunciations, API-provided image/audio URLs,
and valid examples. Invalid or duplicate content items are skipped; an absent usable list
becomes the existing empty state. The DTO is not mutated. Development `?preview=1` remains
a local, non-persisting preview.

## Progress calls

`wwwroot/js/flashcard-progress.js` handles each non-preview `flashcard:session-ready` once:

- `GET /api/progress/lessons/{lessonId}` hydrates the known completed content IDs.
- `POST /api/progress/lessons/{lessonId}/open` records opening the lesson.

Both use `AppApi`, so the Supabase bearer token and existing 401 redirect are retained.
The Flashcard stays usable if the optional initial progress read fails; a later completion
can retry the read. Stale responses are ignored when the session is no longer current.

SCRUM-77 signals its completed-deck rule with a bubbling `flashcard:session-complete`
event on `.flashcard-page`:

```js
page.dispatchEvent(new CustomEvent('flashcard:session-complete', {
    bubbles: true,
    detail: { lessonId: session.lessonId, sessionId: session.sessionId }
}));
```

SCRUM-76 then posts each not-yet-completed content ID to
`POST /api/progress/lessons/{lessonId}/contents/{contentId}/complete`. It does not post
per flip, rating, or navigation. This endpoint is idempotent for XP on the server, so a
retry after a partial network failure can safely repeat a request. After all content is
acknowledged, lessons without a quiz also call
`POST /api/progress/lessons/{lessonId}/complete`. Quiz lessons do not use that route;
their final lesson completion remains owned by the quiz submission flow.

The adapter emits the SCRUM-75 `saving/pending`, then either `completed/saved` after server
responses or `error/failed` with retry enabled. Every emitted state gets a new, greater
`revision`; retry events must reference the failed revision. It never calculates XP or marks
a failed request saved. Completion retry repeats the idempotent server operations. No next
lesson is inferred because the current APIs do not return a verified next step.

## SCRUM-77 client state

`wwwroot/js/flashcard.js` keeps the current index/flip side plus one mark per stable content
ID. The progress bar continues to show position in the deck; the adjacent label separately
shows how many cards are classified. The `flashcard:session-complete` event is emitted only
when a rating action changes the deck from partially classified to fully classified. It is
not inferred from reaching the last card, local ratings restored on reload, cross-tab sync,
empty decks, or repeated clicks. A new page/session resets the emitted flag.

## Contracts verified in repository

- Lesson detail: `LessonEndpoints`, `GET /api/lessons/{lessonId}`, returns
  `LessonDetailResponseDto` with `LessonContentItemDto` content.
- Progress: `ProgressEndpoints`; lesson reads/open and content/lesson completion routes.
- Server results: `LessonProgressDto` (`lessonId`, status, completed content IDs, XP).
- Completion rules and XP are in `LearningResultService`/`ProgressService`; frontend does
  not call these services or the database directly.

The production `flashcard:session-complete` producer is now provided by SCRUM-77 in
`wwwroot/js/flashcard.js`; SCRUM-76 consumes it for persistence. Browser tests exercise the
full path with mocked auth/API responses, but not a real Supabase session or production
database.
