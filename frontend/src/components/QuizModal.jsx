/**
 * components/QuizModal.jsx
 * ------------------------
 * AI Quiz slide-over for a processed video. Flow:
 *   setup   → pick number of questions + difficulty (shows past attempts)
 *   loading → questions are generated from the transcript by the LLM
 *   active  → answer one question at a time with a progress bar
 *   results → server-graded score + per-question review with explanations
 * Correct answers never reach the client until the quiz is submitted.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  X,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Download,
} from "lucide-react";

import Loader from "./Loader";
import QuizPrintDocument from "./QuizPrintDocument";
import { quizApi, getErrorMessage } from "../api/client";
import { usePrintExport } from "../lib/printExport";

const COUNTS = [5, 8, 10];
const DIFFICULTIES = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

const scoreMessage = (pct) => {
  if (pct >= 90) return "Outstanding! You really know this video. 🏆";
  if (pct >= 70) return "Great job — solid understanding! 🎉";
  if (pct >= 50) return "Not bad! A quick rewatch would help. 👍";
  return "Keep learning — try rewatching the video. 📚";
};

const QuizModal = ({ videoId, videoTitle, language, onClose }) => {
  const [phase, setPhase] = useState("setup"); // setup | loading | active | submitting | results
  const [numQuestions, setNumQuestions] = useState(8);
  const [difficulty, setDifficulty] = useState("medium");
  const [attempts, setAttempts] = useState([]);

  const [quiz, setQuiz] = useState(null); // {id, questions:[{question, options}]}
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]); // picked option index per question
  const [result, setResult] = useState(null); // {score,total,percentage,results}
  const { printing, startPrint } = usePrintExport();

  // Past attempts for this video (best-effort; failures are silent)
  useEffect(() => {
    let cancelled = false;
    quizApi
      .attempts(videoId)
      .then((res) => !cancelled && setAttempts(res.data.attempts || []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [videoId, phase === "results"]);

  const startQuiz = async () => {
    setPhase("loading");
    try {
      const res = await quizApi.generate(videoId, language, numQuestions, difficulty);
      const q = res.data.quiz;
      setQuiz(q);
      setAnswers(new Array(q.questions.length).fill(null));
      setCurrent(0);
      setPhase("active");
    } catch (err) {
      toast.error(getErrorMessage(err));
      setPhase("setup");
    }
  };

  const pick = (optionIndex) => {
    setAnswers((a) => {
      const next = [...a];
      next[current] = optionIndex;
      return next;
    });
  };

  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = quiz && answeredCount === quiz.questions.length;

  const submit = async () => {
    if (!allAnswered) {
      toast.error("Answer all questions before submitting");
      return;
    }
    setPhase("submitting");
    try {
      const res = await quizApi.submit(quiz.id, answers);
      setResult(res.data);
      setPhase("results");
    } catch (err) {
      toast.error(getErrorMessage(err));
      setPhase("active");
    }
  };

  const retake = () => {
    setQuiz(null);
    setResult(null);
    setAnswers([]);
    setCurrent(0);
    setPhase("setup");
  };

  const question = quiz?.questions?.[current];
  const progress = quiz ? ((current + 1) / quiz.questions.length) * 100 : 0;

  return (
    <>
      {printing && result && (
        <QuizPrintDocument
          videoTitle={videoTitle}
          difficulty={difficulty}
          result={result}
        />
      )}

    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 text-white">
              <GraduationCap size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight">AI Quiz</h2>
              <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                {videoTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {phase === "results" && result && (
              <button
                onClick={startPrint}
                title="Download as PDF"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                <Download size={17} />
                <span className="hidden sm:inline">PDF</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ---- Setup ---- */}
          {phase === "setup" && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Number of questions</h3>
                <div className="flex gap-2">
                  {COUNTS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setNumQuestions(n)}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                        numQuestions === n
                          ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
                          : "border-slate-300 text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Difficulty</h3>
                <div className="flex gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDifficulty(d.id)}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                        difficulty === d.id
                          ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
                          : "border-slate-300 text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={startQuiz} className="btn-primary w-full py-3">
                <GraduationCap size={17} /> Generate Quiz
              </button>

              {attempts.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Trophy size={14} className="text-amber-500" /> Past attempts
                  </h3>
                  <ul className="space-y-2">
                    {attempts.slice(0, 5).map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                      >
                        <span className="text-slate-600 dark:text-slate-300">
                          {a.completed_at
                            ? new Date(a.completed_at).toLocaleString()
                            : "—"}{" "}
                          · {a.difficulty}
                        </span>
                        <span className="font-semibold text-brand-600 dark:text-brand-300">
                          {a.score}/{a.total}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ---- Loading ---- */}
          {phase === "loading" && (
            <div className="flex h-full items-center justify-center">
              <Loader label="Generating questions from the video..." />
            </div>
          )}

          {/* ---- Active quiz ---- */}
          {(phase === "active" || phase === "submitting") && question && (
            <div className="flex h-full flex-col">
              {/* Progress */}
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>
                    Question {current + 1} of {quiz.questions.length}
                  </span>
                  <span>{answeredCount} answered</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-600 to-purple-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <h3 className="mb-4 text-base font-semibold leading-relaxed">
                {question.question}
              </h3>

              <div className="space-y-2.5">
                {question.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => pick(i)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors ${
                      answers[current] === i
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
                        : "border-slate-300 text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                        answers[current] === i
                          ? "border-brand-500 bg-brand-600 text-white"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="mt-auto flex items-center justify-between gap-2 pt-6">
                <button
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                  disabled={current === 0}
                  className="btn-ghost px-3 py-2 text-sm disabled:opacity-40"
                >
                  <ChevronLeft size={16} /> Previous
                </button>

                {current < quiz.questions.length - 1 ? (
                  <button
                    onClick={() =>
                      setCurrent((c) => Math.min(quiz.questions.length - 1, c + 1))
                    }
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={submit}
                    disabled={!allAnswered || phase === "submitting"}
                    className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {phase === "submitting" ? "Grading..." : "Submit Quiz"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ---- Results ---- */}
          {phase === "results" && result && (
            <div className="space-y-6">
              {/* Score card */}
              <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-purple-600 p-6 text-center text-white">
                <Trophy size={32} className="mx-auto mb-2 text-amber-300" />
                <div className="text-4xl font-extrabold">
                  {result.score}/{result.total}
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {result.percentage}%
                </div>
                <p className="mt-2 text-sm text-white/90">
                  {scoreMessage(result.percentage)}
                </p>
              </div>

              {/* Review */}
              <div className="space-y-4">
                {result.results.map((r, qi) => (
                  <div
                    key={qi}
                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="mb-3 flex items-start gap-2">
                      {r.is_correct ? (
                        <CheckCircle2
                          size={18}
                          className="mt-0.5 shrink-0 text-emerald-500"
                        />
                      ) : (
                        <XCircle size={18} className="mt-0.5 shrink-0 text-rose-500" />
                      )}
                      <p className="text-sm font-semibold">
                        {qi + 1}. {r.question}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      {r.options.map((opt, oi) => {
                        const isCorrect = oi === r.correct_index;
                        const isPicked = oi === r.your_answer;
                        return (
                          <div
                            key={oi}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                              isCorrect
                                ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                : isPicked
                                ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                                : "border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400"
                            }`}
                          >
                            <span className="font-bold">
                              {String.fromCharCode(65 + oi)}.
                            </span>
                            {opt}
                            {isCorrect && (
                              <CheckCircle2 size={13} className="ml-auto shrink-0" />
                            )}
                            {isPicked && !isCorrect && (
                              <XCircle size={13} className="ml-auto shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={retake} className="btn-ghost flex-1 py-2.5 text-sm">
                  <RotateCcw size={15} /> Retake
                </button>
                <button onClick={onClose} className="btn-primary flex-1 py-2.5 text-sm">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
    </>
  );
};

export default QuizModal;
