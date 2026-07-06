/**
 * components/QuizPrintDocument.jsx
 * --------------------------------
 * Print-only rendering of graded quiz results: a compact document header with
 * the video title, the score, then every question with its options — the
 * correct answer and the user's pick marked, matching the on-screen review.
 * Portaled to <body> and shown only while printing (see `.print-root` CSS).
 */
import { createPortal } from "react-dom";

const QuizPrintDocument = ({ videoTitle, difficulty, result }) => {
  return createPortal(
    <div className="print-root">
      <header className="print-doc-header">
        <div className="print-doc-kicker">Quiz Results</div>
        <h1 className="print-doc-title">{videoTitle || "Untitled video"}</h1>
      </header>

      <div className="print-quiz-score">
        <strong>
          Score: {result.score}/{result.total} ({result.percentage}%)
        </strong>
        {difficulty ? <span> · {difficulty} difficulty</span> : null}
      </div>

      <ol className="print-quiz-list">
        {result.results.map((r, qi) => (
          <li key={qi} className="print-quiz-q">
            <p className="print-quiz-question">
              {qi + 1}. {r.question}{" "}
              <span className={r.is_correct ? "print-quiz-ok" : "print-quiz-bad"}>
                {r.is_correct ? "✓ Correct" : "✗ Incorrect"}
              </span>
            </p>
            <div className="print-quiz-opts">
              {r.options.map((opt, oi) => {
                const isCorrect = oi === r.correct_index;
                const isPicked = oi === r.your_answer;
                const cls = isCorrect
                  ? "print-quiz-opt print-quiz-opt-correct"
                  : isPicked
                  ? "print-quiz-opt print-quiz-opt-wrong"
                  : "print-quiz-opt";
                return (
                  <div key={oi} className={cls}>
                    <span className="print-quiz-letter">
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    <span>{opt}</span>
                    {isCorrect ? (
                      <span className="print-quiz-tag">Correct answer</span>
                    ) : isPicked ? (
                      <span className="print-quiz-tag">Your answer</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </div>,
    document.body
  );
};

export default QuizPrintDocument;
