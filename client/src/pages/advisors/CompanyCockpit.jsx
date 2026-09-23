import { useId } from 'react';
import { buildCompanyCockpit } from './companyCockpit.js';
import './cockpit.css';

const START = 240;
const SWEEP = 240;

function money(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
}

function compactMoney(n) {
  const rounded = Math.round(Number(n) || 0);
  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';
  const trim = (value) => {
    const text = value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
    return `${sign}$${text}`;
  };
  if (abs >= 1e9) return `${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${trim(abs / 1e6)}M`;
  if (abs >= 1e4) return `${trim(abs / 1e3)}K`;
  return `${sign}$${abs.toLocaleString('en-US')}`;
}

function count(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-US');
}

function pct(fraction, digits = 1) {
  if (fraction == null || !Number.isFinite(Number(fraction))) return '—';
  return `${(Number(fraction) * 100).toFixed(digits)}%`;
}

function clamp01(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1, n);
}

function polar(cx, cy, r, degFrom12) {
  const rad = ((degFrom12 - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx, cy, r, startDeg, sweepDeg) {
  if (sweepDeg <= 0.05) return '';
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function needlePath(cx, cy, angle, length) {
  const tip = polar(cx, cy, length, angle);
  const left = polar(cx, cy, 3.6, angle - 88);
  const right = polar(cx, cy, 3.6, angle + 88);
  const tail = polar(cx, cy, 11, angle + 180);
  return `M ${tip[0].toFixed(2)} ${tip[1].toFixed(2)} L ${right[0].toFixed(2)} ${right[1].toFixed(2)} L ${tail[0].toFixed(2)} ${tail[1].toFixed(2)} L ${left[0].toFixed(2)} ${left[1].toFixed(2)} Z`;
}

function AnalogGauge({
  label,
  face,
  actualText,
  targetText,
  extra,
  ratio,
  markerRatio,
  status,
  statusCode,
}) {
  const uid = useId().replace(/:/g, '');
  const cx = 100;
  const cy = 88;
  const r = 58;
  const shown = clamp01(ratio);
  const angle = START + SWEEP * shown;
  const marker = markerRatio == null ? null : START + SWEEP * clamp01(markerRatio);
  const ticks = [];
  for (let i = 0; i <= 10; i += 1) {
    const deg = START + (SWEEP * i) / 10;
    const outer = polar(cx, cy, r + 1, deg);
    const inner = polar(cx, cy, i % 5 === 0 ? r - 11 : r - 6, deg);
    ticks.push({ i, outer, inner, hot: i >= 8 });
  }
  const markerPoint = marker == null ? null : polar(cx, cy, r + 12, marker);

  return (
    <figure className="cockpit-gauge">
      <div className="cockpit-dial">
        <svg className="cockpit-svg" viewBox="0 0 200 172" aria-hidden="true">
          <defs>
            <radialGradient id={`${uid}-face`} cx="50%" cy="38%" r="68%">
              <stop offset="0%" stopColor="#243140" />
              <stop offset="70%" stopColor="#121820" />
              <stop offset="100%" stopColor="#07090d" />
            </radialGradient>
            <linearGradient id={`${uid}-bezel`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b98a8" />
              <stop offset="35%" stopColor="#2c3848" />
              <stop offset="100%" stopColor="#121820" />
            </linearGradient>
          </defs>
          <circle cx={cx} cy={cy} r="72" fill={`url(#${uid}-bezel)`} />
          <circle cx={cx} cy={cy} r="66" fill="#0b0e13" stroke="#1c2633" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="62" fill={`url(#${uid}-face)`} />
          <path
            d={arcPath(cx, cy, r + 4, START, SWEEP)}
            fill="none"
            stroke="#c1622f"
            strokeWidth="3"
            strokeLinecap="butt"
            opacity="0.95"
          />
          <path
            d={arcPath(cx, cy, r - 14, START, SWEEP)}
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
            strokeLinecap="butt"
          />
          <path
            d={arcPath(cx, cy, r - 14, START, SWEEP * shown)}
            fill="none"
            stroke="#2eb860"
            strokeWidth="8"
            strokeLinecap="butt"
          />
          {ticks.map((tick) => (
            <line
              key={tick.i}
              x1={tick.inner[0]}
              y1={tick.inner[1]}
              x2={tick.outer[0]}
              y2={tick.outer[1]}
              stroke={tick.hot ? '#fca5a5' : '#cbd5e1'}
              strokeWidth={tick.i % 5 === 0 ? 2 : 1}
              strokeLinecap="round"
            />
          ))}
          {markerPoint && (
            <circle cx={markerPoint[0]} cy={markerPoint[1]} r="3.5" fill="#7dd3fc" stroke="#0b0e13" strokeWidth="1" />
          )}
          <path d={needlePath(cx, cy, angle, r - 16)} fill="#f8fafc" />
          <circle cx={cx} cy={cy} r="7" fill="#c1622f" />
          <circle cx={cx} cy={cy} r="3" fill="#1a120e" />
          {[330, 30, 150, 210].map((deg) => {
            const [x, y] = polar(cx, cy, 69, deg);
            return (
              <g key={deg}>
                <circle cx={x} cy={y} r="3.1" fill="#0e141c" stroke="#8b98a8" strokeWidth="1" />
                <circle cx={x} cy={y} r="1" fill="#d5dee8" />
              </g>
            );
          })}
        </svg>
        <div className="cockpit-face">{face}</div>
      </div>
      <figcaption>
        <div className="cockpit-label">{label}</div>
        <div className="cockpit-actual">{actualText}</div>
        <div className="cockpit-target">{targetText}</div>
        {extra ? <div className="cockpit-note">{extra}</div> : null}
        {status ? <div className={`cockpit-status is-${statusCode || 'even'}`}>{status}</div> : null}
      </figcaption>
    </figure>
  );
}

function leaderValue(leader, person) {
  if (leader.basis === 'deals_closed') {
    const n = Math.round(person.value);
    return `${n.toLocaleString('en-US')} ${n === 1 ? 'deal' : 'deals'}`;
  }
  return money(person.value);
}

function leaderMeta(leader, person) {
  if (leader.basis === 'gci_actual') {
    return `${count(person.dealsClosed)} closed · target ${money(person.incomeTarget)}`;
  }
  if (leader.basis === 'deals_closed') {
    return person.actualGci > 0
      ? `${money(person.actualGci)} GCI booked`
      : `Income target ${money(person.incomeTarget)}`;
  }
  return `${count(person.dealsToClose)} deals to close`;
}

function PolePosition({ leader, onSelect }) {
  if (!leader.leaders.length) {
    return (
      <div className="cockpit-podium" data-testid="pole-position">
        <div className="cockpit-podium-head">
          <div className="cockpit-podium-title">Pole position</div>
        </div>
        <div className="cockpit-empty-board">No one has an income target or a YTD result yet.</div>
      </div>
    );
  }

  const tie = leader.tied;
  return (
    <div className="cockpit-podium" data-testid="pole-position">
      <div className="cockpit-podium-head">
        <div className="cockpit-podium-title">{tie ? 'Pole position · tie' : 'Pole position'}</div>
        <div className="cockpit-podium-basis">
          {tie ? `Tied on ${leader.basisLabel}` : `Leading on ${leader.basisLabel}`}
        </div>
      </div>
      <div className="cockpit-drivers">
        {leader.leaders.map((person) => (
          <button
            key={person.id}
            type="button"
            className="cockpit-driver"
            aria-label={`Open ${person.name}'s plan. ${tie ? 'Tied for the lead' : 'Leading'} on ${leader.basisLabel}.`}
            onClick={() => onSelect?.(person.id)}
          >
            <span className="cockpit-rank">{tie ? 'T1' : '#1'}</span>
            <span className="cockpit-driver-name">{person.name}</span>
            {person.role ? <span className="cockpit-driver-role">{person.role}</span> : null}
            <span className="cockpit-driver-value">{leaderValue(leader, person)}</span>
            <span className="cockpit-driver-meta">{leaderMeta(leader, person)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CompanyCockpit({ year, people, kpis, onSelect }) {
  const model = buildCompanyCockpit({ year, people, kpis });
  const gciRatio = model.gci.target > 0 ? model.gci.actual / model.gci.target : 0;
  const pipelineRatio = model.pipeline.target > 0 ? model.pipeline.actual / model.pipeline.target : 0;
  const dealsRatio = model.deals.target > 0 ? model.deals.actual / model.deals.target : 0;
  const engagementRatio = model.engagements.target > 0 ? model.engagements.actual / model.engagements.target : 0;
  const rosterRatio = model.roster.withPlan > 0 ? model.roster.withIncomeTarget / model.roster.withPlan : 0;

  return (
    <section className="cockpit" aria-label={`${year} company cockpit`} data-testid="company-cockpit">
      <header className="cockpit-head">
        <div>
          <div className="cockpit-kicker">Instrument cluster</div>
          <h2 className="cockpit-title">Company cockpit</h2>
        </div>
        <div className="cockpit-head-meta">
          <span className="cockpit-year">{year}</span>
          <span className="cockpit-pill">Plan rollup</span>
        </div>
      </header>

      <div className="cockpit-key">
        <span><i className="cockpit-swatch cockpit-swatch-needle" aria-hidden="true" /> Needle is the reading</span>
        <span><i className="cockpit-swatch cockpit-swatch-ring" aria-hidden="true" /> Copper ring is full scale</span>
        <span><i className="cockpit-swatch cockpit-swatch-fill" aria-hidden="true" /> Green arc fills toward the target</span>
        <span><i className="cockpit-swatch cockpit-swatch-clock" aria-hidden="true" /> Blue dot on Pace is the year elapsed</span>
      </div>

      <div className="cockpit-gauges">
        <div data-testid="gauge-engagements">
          <AnalogGauge
            label="Engagements"
            face={count(model.engagements.actual)}
            ratio={engagementRatio}
            actualText={`${count(model.engagements.actual)} signed`}
            targetText={`Target ${count(model.engagements.target)}`}
            extra="Signed count is not on the plan"
          />
        </div>
        <div data-testid="gauge-pipeline">
          <AnalogGauge
            label="Pipeline $"
            face={compactMoney(model.pipeline.actual)}
            ratio={pipelineRatio}
            actualText={`${money(model.pipeline.actual)} active`}
            targetText={`Target ${money(model.pipeline.target)}`}
            extra="Commission basis"
          />
        </div>
        <div data-testid="gauge-gci">
          <AnalogGauge
            label="GCI"
            face={compactMoney(model.gci.actual)}
            ratio={gciRatio}
            actualText={`${money(model.gci.actual)} booked`}
            targetText={`Target ${money(model.gci.target)}`}
            extra="Team income"
          />
        </div>
        <div data-testid="gauge-deals">
          <AnalogGauge
            label="Deals"
            face={count(model.deals.actual)}
            ratio={dealsRatio}
            actualText={`${count(model.deals.actual)} closed`}
            targetText={`Target ${count(model.deals.target)}`}
            extra="Deals to close"
          />
        </div>
        <div data-testid="gauge-pace">
          <AnalogGauge
            label="Pace"
            face={model.pace.goal == null ? '—' : pct(model.pace.goal, 0)}
            ratio={model.pace.goal || 0}
            markerRatio={model.pace.elapsed}
            actualText={model.pace.goal == null ? 'No GCI target' : `${pct(model.pace.goal)} of goal`}
            targetText={`${pct(model.pace.elapsed, 0)} of ${year} elapsed`}
            status={model.pace.label}
            statusCode={model.pace.code}
          />
        </div>
      </div>

      <div className="cockpit-lower">
        <PolePosition leader={model.leader} onSelect={onSelect} />
        <div data-testid="gauge-close">
          <AnalogGauge
            label="Closing ratio"
            face={model.closeRatio.assumed == null ? '—' : pct(model.closeRatio.assumed, 0)}
            ratio={model.closeRatio.assumed || 0}
            actualText={model.closeRatio.assumed == null ? 'No assumed ratio' : `Assumed ${pct(model.closeRatio.assumed)}`}
            targetText="Implied —"
            extra="Signed engagements are not stored"
          />
        </div>
        <div data-testid="gauge-roster">
          <AnalogGauge
            label="Roster"
            face={`${model.roster.withIncomeTarget}`}
            ratio={rosterRatio}
            actualText={`${model.roster.withIncomeTarget} with income targets`}
            targetText={`${model.roster.withPlan} with a plan`}
          />
        </div>
        <div className="cockpit-digital" data-testid="deal-volume">
          <div className="cockpit-kicker">Deal volume</div>
          <div className="cockpit-digital-value">{compactMoney(model.pipeline.dealVolumeTarget)}</div>
          <div className="cockpit-actual">{money(model.pipeline.dealVolumeTarget)} target</div>
          <div className="cockpit-note">Target engagement pipeline, deal volume. Active pipeline dollars sit on the Pipeline $ gauge.</div>
        </div>
      </div>

      <p className="cockpit-footnote">
        Targets are the {year} WTF rollup. Needles use the YTD fields saved on each plan: actual GCI, deals closed, and active pipeline. Blank fields read as zero, so a resting needle is an empty actual, not a missing gauge.
      </p>
    </section>
  );
}
