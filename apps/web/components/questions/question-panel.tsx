import type { AttemptAnswerPayload, QuestionPayload } from "@ci-train/contracts";
import { Markdown } from "@/components/markdown";
import { MultiChoiceQuestion } from "./multi-choice-question";
import { ConfidenceQuestion } from "./confidence-question";
import { TextQuestion } from "./text-question";

interface Props {
  attemptId: string;
  questions: QuestionPayload[];
  answers: AttemptAnswerPayload[];
  locked: boolean;
}

export function QuestionPanel({ attemptId, questions, answers, locked }: Props) {
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  return (
    <section className="q-panel">
      {questions.map((q) => {
        const a = byQ.get(q.id) ?? null;
        return (
          <article key={q.id} className="card q-card">
            <header className="q-header">
              <span className="q-ordinal">Q{q.ordinal}</span>
              <span className="chip">{q.type.replace(/_/g, " ")}</span>
              <span className="chip">weight {q.weight}</span>
            </header>
            <div className="q-prompt">
              <Markdown source={q.promptMd} />
            </div>
            <QuestionWidget attemptId={attemptId} question={q} answer={a} locked={locked} />
          </article>
        );
      })}
    </section>
  );
}

function QuestionWidget({
  attemptId,
  question,
  answer,
  locked,
}: {
  attemptId: string;
  question: QuestionPayload;
  answer: AttemptAnswerPayload | null;
  locked: boolean;
}) {
  switch (question.type) {
    case "multi_choice": {
      const r = answer?.response;
      const initial = r && r.type === "multi_choice" ? r.data.selectedIds : [];
      return (
        <MultiChoiceQuestion
          attemptId={attemptId}
          question={question}
          initialSelectedIds={initial}
          locked={locked}
        />
      );
    }
    case "confidence": {
      const r = answer?.response;
      const initial = r && r.type === "confidence" ? r.data.value : null;
      return (
        <ConfidenceQuestion
          attemptId={attemptId}
          question={question}
          initialValue={initial}
          locked={locked}
        />
      );
    }
    case "short_answer": {
      const r = answer?.response;
      const initial = r && r.type === "short_answer" ? r.data.text : "";
      return (
        <TextQuestion
          attemptId={attemptId}
          question={question}
          initialText={initial}
          locked={locked}
          variant="short"
        />
      );
    }
    case "long_answer": {
      const r = answer?.response;
      const initial = r && r.type === "long_answer" ? r.data.text : "";
      return (
        <TextQuestion
          attemptId={attemptId}
          question={question}
          initialText={initial}
          locked={locked}
          variant="long"
        />
      );
    }
    default:
      return null;
  }
}
