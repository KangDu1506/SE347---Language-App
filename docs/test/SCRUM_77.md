# SCRUM-77 - Complete-deck review signal

## Rule

A Flashcard review session is complete only after every stable content ID in the deck has a
valid local rating (`know` or `again`). Reaching the last card, flipping cards, restoring saved
ratings on reload, cross-tab updates, empty decks, or repeated clicks do not emit completion.

## Implementation

- `wwwroot/js/flashcard.js` tracks ratings by content ID and hydrates the current account scope.
- The progress label reports deck position through `[data-card-count]` and the progress bar;
  `[data-answered-count]` separately reports classified cards using `flashcard.answered_count`.
- A rating action emits one bubbling `flashcard:session-complete` event when the deck changes
  from partially classified to fully classified. The event includes `lessonId`, `sessionId`,
  `contentIds`, and `total`.
- The emitted flag resets on a new page/session, lesson reload, or account change.
- SCRUM-76 consumes the event for server persistence. The Flashcard UI never calculates XP.

## Verification

- `node --check wwwroot/js/flashcard.js`: PASS.
- `node docs/test/flashcard-progress.cjs`: PASS for adapter/completion contracts.
- `node docs/test/flashcard-browser.cjs`: PASS for one-time completion after all cards are
  classified, answered count, lesson switch, single-card deck, reload behavior, navigation lock,
  and no JavaScript errors.
- `dotnet test tests/SE347.Tests/SE347.Tests.csproj --no-restore`: 51 passed, 0 failed.

## Limits

Browser tests use mocked auth/API responses and fixture lesson JSON. Real Supabase sessions,
production progress, and XP values remain unverified in this repository.
