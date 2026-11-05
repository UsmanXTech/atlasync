import Card from '../components/Card';
import Stat from '../components/Stat';
import { TrendChart } from '../components/Bars';
import { INSIGHTS_WEEKLY } from '../data/mock';
import { BarChart3, FileText, GitPullRequest } from 'lucide-react';

export default function Insights() {
  const totalIssues = INSIGHTS_WEEKLY.reduce((s, p) => s + p.issues, 0);
  const totalDocs = INSIGHTS_WEEKLY.reduce((s, p) => s + p.docs, 0);
  const totalPrs = INSIGHTS_WEEKLY.reduce((s, p) => s + p.prs, 0);
  const busiest = INSIGHTS_WEEKLY.reduce((best, p) =>
    p.issues + p.docs + p.prs > best.issues + best.docs + best.prs ? p : best,
  );

  return (
    <div className="view">
      <div className="view-head">
        <h2>Insights</h2>
        <p>Weekly throughput across tools — derived from the mock dataset, not live analytics.</p>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <Stat label="Issues closed · 6 weeks" value={String(totalIssues)} delta="Busiest week: W4" tone="flat" icon={BarChart3} />
        <Stat label="Docs updated · 6 weeks" value={String(totalDocs)} delta="Steady upward trend" tone="up" icon={FileText} />
        <Stat label="PRs touched · 6 weeks" value={String(totalPrs)} delta="Peak in W4" tone="flat" icon={GitPullRequest} />
      </div>

      <Card title="Weekly activity trend" subtitle="Issues, docs, and PRs per week">
        <TrendChart points={INSIGHTS_WEEKLY} />
      </Card>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <Card title="Top signals" subtitle="What the sample data says">
          <div className="row-list">
            <div className="data-row">
              <div className="row-main">
                <strong>Busiest week: {busiest.label}</strong>
                <small>
                  {busiest.issues} issues · {busiest.docs} docs · {busiest.prs} PRs
                </small>
              </div>
            </div>
            <div className="data-row">
              <div className="row-main">
                <strong>Docs keep climbing</strong>
                <small>From 18 to 31 weekly updates across the period</small>
              </div>
            </div>
            <div className="data-row">
              <div className="row-main">
                <strong>PR throughput follows issues</strong>
                <small>High-issue weeks show proportionally more PR activity</small>
              </div>
            </div>
          </div>
        </Card>
        <Card title="About these numbers" subtitle="Honest labeling">
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--muted)' }}>
            These charts render the mock dataset in <code>src/data/mock.ts</code>. They demonstrate the
            visualization layer only. Once real integrations land, the same components will render live
            aggregates — no chart code changes needed, only the data source.
          </p>
        </Card>
      </div>
    </div>
  );
}
