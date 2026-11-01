# SCRUM-76 - Flashcard lesson data and progress

## Scope

Connect the production Flashcard page to the existing authenticated lesson and progress APIs
without changing backend contracts, adding dependencies, or writing progress directly.

## Implementation

- `wwwroot/js/flashcard-data.js` maps `GET /api/lessons/{lessonId}` (`LessonDetailResponseDto`)
  into stable Flashcard view models. It validates the route/response lesson ID, keeps text,
  pronunciations, API-provided image/audio URLs, and valid examples, and skips malformed or
  duplicate content items. An unusable payload shows the existing error state; a valid empty
  list shows the empty state.
- `wwwroot/js/flashcard-progress.js` handles each non-preview `flashcard:session-ready` once:
  `GET /api/progress/lessons/{lessonId}` hydrates completed content IDs and
  `POST /api/progress/lessons/{lessonId}/open` records the opening. Both use `AppApi`, so the
  bearer token and 401 redirect remain unchanged.
- After `flashcard:session-complete`, it posts each not-yet-completed content ID to
  `/api/progress/lessons/{lessonId}/contents/{contentId}/complete`. Lessons without a quiz then
  call `/api/progress/lessons/{lessonId}/complete`; quiz lessons remain owned by quiz submission.
- The adapter emits SCRUM-75 completion states with strictly increasing revisions:
  `saving/pending`, then `completed/saved` or `error/failed` with retry. It never calculates XP,
  never marks an unconfirmed request as saved, and ignores stale session responses.

## Verification

- `node docs/test/flashcard-progress.cjs`: PASS - mapper validation, open/read calls, idempotent
  completion, quiz guard, failure/retry, and revision ordering.
- `node docs/test/flashcard-browser.cjs`: PASS - real lesson content, loading/empty/error,
  invalid payloads, duplicate IDs, progress endpoints, completion UI, retry, navigation guards,
  responsive/accessibility regressions.
- `dotnet test tests/SE347.Tests/SE347.Tests.csproj --no-restore`: 51 passed, 0 failed.

## Limits

Browser verification uses mocked auth/API responses. It does not prove a real Supabase session,
production database writes, or XP persistence.
