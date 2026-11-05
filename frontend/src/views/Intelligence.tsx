import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import Card from '../components/Card';
import Gauge from '../components/Gauge';
import { AI_RESPONSES, BLOCKERS, INCIDENTS } from '../data/mock';
import type { AiResponse } from '../data/types';

function genericResponse(prompt: string): AiResponse {
  const openBlockers = BLOCKERS.slice(0, 2).map((b) => `${b.key} — ${b.title} (${b.severity}, ${b.ageDays} days open)`);
  const openIncidents = INCIDENTS.filter((i) => i.status !== 'resolved').map(
    (i) => `${i.title} (${i.severity.toUpperCase()}, ${i.status})`,
  );
  return {
    prompt,
    readiness: 68,
    verdict: 'Sample assessment — this is mock data, not a real analysis.',
    summary:
      'This answer is a sample generated from the dashboard’s mock dataset. A real Atlasync assessment would weigh live blockers, incidents, PR health, and change volume from your connected tools.',
    blockers: [...openBlockers, ...openIncidents],
    risks: [
      'Sample risk: open critical items correlate with release-day incidents in this mock dataset.',
      'Sample risk: unreviewed changes on shared paths increase regression surface.',
    ],
    issues: [...BLOCKERS.slice(0, 2).map((b) => b.key), ...INCIDENTS.filter((i) => i.status !== 'resolved').map((i) => i.title)],
    actions: [
      { title: 'Triage the oldest critical blocker first', owner: 'Team lead', due: 'Today' },
      { title: 'Review open Sev1/Sec2 incidents before sign-off', owner: 'On-call', due: 'Today' },
    ],
  };
}

export default function Intelligence() {
  const [prompt, setPrompt] = useState(AI_RESPONSES[0].prompt);
  const [answer, setAnswer] = useState<AiResponse>(AI_RESPONSES[0]);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPrompt(trimmed);
    const known = AI_RESPONSES.find((r) => r.prompt.toLowerCase() === trimmed.toLowerCase());
    setAnswer(known ?? genericResponse(trimmed));
  };

  return (
    <div className="view">
      <div className="view-head">
        <h2>Intelligence</h2>
        <p>Ask about release readiness. Every answer below is a sample — mock data only.</p>
      </div>

      <div className="grid-2">
        <Card title="Ask Atlasync AI" subtitle="Sample prompts · responses are mock data">
          <div className="composer">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about a release, a project, or the week…"
              aria-label="AI prompt"
            />
            <div className="preset-row">
              <span>Try:</span>
              {AI_RESPONSES.map((r) => (
                <button
                  key={r.prompt}
                  className={`preset-btn ${answer.prompt === r.prompt ? 'active' : ''}`}
                  onClick={() => ask(r.prompt)}
                >
                  {r.prompt}
                </button>
              ))}
            </div>
            <div>
              <button className="btn btn-primary" onClick={() => ask(prompt)}>
                <Send size={14} /> Ask
              </button>
            </div>
          </div>
        </Card>

        <Card title="Release readiness" subtitle="Sample response · Mock data">
          <div className="ai-teaser">
            <Gauge value={answer.readiness} label="Ready" />
            <div>
              <p>
                <strong>{answer.verdict}</strong>
              </p>
              <p>
                <span className="mock-badge">MOCK DATA</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Assessment" subtitle={`Prompt: “${answer.prompt}” · Sample response`}>
        <div className="ai-answer">
          <div>
            <h4>Summary</h4>
            <p className="ai-summary">{answer.summary}</p>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div>
              <h4>Critical blockers</h4>
              <ul>
                {answer.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Risk assessment</h4>
              <ul>
                {answer.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div>
              <h4>Relevant issues</h4>
              <ul>
                {answer.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Suggested next actions</h4>
              {answer.actions.map((a) => (
                <div className="action-row" key={a.title}>
                  <span>{a.title}</span>
                  <small>
                    {a.owner} · {a.due}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--faint)' }}>
            <Sparkles size={13} /> This panel demonstrates the response format. No live data, no real AI call —
            the content is fixed sample data until integrations land.
          </p>
        </div>
      </Card>
    </div>
  );
}
