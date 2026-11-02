// Adapter from the API's LessonDetailResponseDto JSON to the flashcard view model.
(() => {
    const hasText = value => typeof value === 'string' && value.trim().length > 0;

    function mapLesson(lesson, expectedLessonId) {
        if (!lesson || lesson.lessonId !== expectedLessonId || !hasText(lesson.name) || !Array.isArray(lesson.contents)) {
            return null;
        }

        const ids = new Set();
        const cards = [];
        for (const item of lesson.contents) {
            if (!item || !hasText(item.id) || ids.has(item.id) || !hasText(item.content)
                || !hasText(item['definition-vi']) || !hasText(item['definition-en'])) continue;
            ids.add(item.id);
            const examples = Array.isArray(item.examples)
                ? item.examples.filter(example => example && hasText(example.term) && hasText(example.translation))
                    .map(example => ({ term: example.term, translation: example.translation }))
                : [];
            cards.push({
                id: item.id,
                content: item.content,
                'definition-vi': item['definition-vi'],
                'definition-en': item['definition-en'],
                'pronunciation-bre': typeof item['pronunciation-bre'] === 'string' ? item['pronunciation-bre'] : null,
                'pronunciation-name': typeof item['pronunciation-name'] === 'string' ? item['pronunciation-name'] : null,
                image: typeof item.image === 'string' ? item.image : null,
                audio: typeof item.audio === 'string' ? item.audio : null,
                examples
            });
        }

        return { lessonId: lesson.lessonId, name: lesson.name, category: lesson.category,
            hasQuiz: Array.isArray(lesson.quiz) && lesson.quiz.length > 0, contents: cards };
    }

    window.FlashcardData = Object.freeze({ mapLesson });
})();
