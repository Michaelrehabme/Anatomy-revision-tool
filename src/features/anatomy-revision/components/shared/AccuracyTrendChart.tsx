import { useState } from "react";
import type { AccuracyTrendPoint } from "../../lib/accuracyTrend";
import { ACCURACY_WINDOW_DAYS_DEFAULT } from "../../lib/accuracyTrend";

/**
 * Accuracy over time — one line for the person, and where the data exists, a
 * dashed line for their class average. Inline SVG, like every other chart
 * here, so no charting dependency.
 *
 * Shown to an educator about a student, and to a student about themselves.
 * A student sees no class line: firestore.rules won't let them read anyone
 * else's attempts, so the comparison genuinely isn't theirs to have, and the
 * legend drops to one entry rather than showing an empty series.
 *
 * Where both lines are drawn they carry different dash patterns, because
 * colour alone must never be the only thing telling them apart. The y-axis is pinned to 0–100 rather than fitted to the data:
 * an auto-fitted axis makes a 4-point wobble look like a transformation, and
 * this chart's whole job is to answer "is this real improvement?" honestly.
 *
 * Gaps are deliberate. A null point (too few attempts in the window to mean
 * anything — see accuracyTrend.ts) breaks the line instead of interpolating
 * through days the student never revised.
 */

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 30, left: 38 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const Y_TICKS = [0, 25, 50, 75, 100];

const x = (i: number, count: number) =>
  PAD.left + (count <= 1 ? PLOT_W / 2 : (i / (count - 1)) * PLOT_W);
const y = (pct: number) => PAD.top + PLOT_H - (pct / 100) * PLOT_H;

/** One <path> per unbroken run, so a null point leaves a gap rather than a straight line across it. */
function segments(
  points: AccuracyTrendPoint[],
  value: (p: AccuracyTrendPoint) => number | null,
): string[] {
  const paths: string[] = [];
  let current: string[] = [];

  points.forEach((point, i) => {
    const pct = value(point);
    if (pct === null) {
      if (current.length > 1) paths.push(current.join(" "));
      current = [];
      return;
    }
    current.push(
      `${current.length === 0 ? "M" : "L"} ${x(i, points.length).toFixed(1)} ${y(pct).toFixed(1)}`,
    );
  });
  if (current.length > 1) paths.push(current.join(" "));

  return paths;
}

const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

export function AccuracyTrendChart({
  points,
  studentName,
}: {
  points: AccuracyTrendPoint[];
  studentName: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const drawable = points.filter((p) => p.studentPct !== null);
  const hasCohortLine = points.some((p) => p.cohortPct !== null);
  if (drawable.length < 2) {
    return (
      <div
        className="mt-4 text-sm leading-relaxed"
        style={{ color: "var(--ink3)", maxWidth: 560 }}
      >
        Not enough attempts yet to show a trend — this needs at least{" "}
        {ACCURACY_WINDOW_DAYS_DEFAULT} days with enough answers in them to be
        worth plotting. The accuracy figure above still counts every attempt.
      </div>
    );
  }

  const hovered = hover !== null ? points[hover] : null;

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = (px - PAD.left) / PLOT_W;
    const index = Math.round(ratio * (points.length - 1));
    setHover(index >= 0 && index < points.length ? index : null);
  };

  return (
    <div className="mt-4">
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-1.5"
        style={{ font: "400 12.5px/1 var(--font-ui)", color: "var(--ink2)" }}
      >
        <span className="flex items-center gap-2">
          <svg width="18" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="18"
              y2="4"
              stroke="var(--acc)"
              strokeWidth="2"
            />
          </svg>
          {studentName}
        </span>
        {hasCohortLine && (
          <span className="flex items-center gap-2">
            <svg width="18" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="18"
                y2="4"
                stroke="var(--acc2d)"
                strokeWidth="2"
                strokeDasharray="5 3"
              />
            </svg>
            Class average
          </span>
        )}
        <span style={{ color: "var(--ink3)" }}>
          · {ACCURACY_WINDOW_DAYS_DEFAULT}-day rolling accuracy
        </span>
      </div>

      {/* Scrolls rather than shrinks on a narrow screen, like ActiveUsersChart:
          scaling a 720-wide viewBox into a 340px phone drags the axis labels
          down to about 5px, which is a chart nobody can read. */}
      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{
            maxWidth: WIDTH,
            minWidth: 520,
            overflow: "visible",
            touchAction: "none",
          }}
          role="img"
          aria-label={
            hasCohortLine
              ? `${studentName}'s rolling accuracy compared with the class average, from ${points[0].date} to ${points[points.length - 1].date}`
              : `${studentName}'s rolling accuracy from ${points[0].date} to ${points[points.length - 1].date}`
          }
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {Y_TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={y(tick)}
                x2={WIDTH - PAD.right}
                y2={y(tick)}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 3.5}
                textAnchor="end"
                style={{
                  font: "400 10px/1 var(--font-mono)",
                  fill: "var(--ink3)",
                }}
              >
                {tick}%
              </text>
            </g>
          ))}

          <text
            x={PAD.left}
            y={HEIGHT - 8}
            style={{ font: "400 10px/1 var(--font-mono)", fill: "var(--ink3)" }}
          >
            {shortDate(points[0].date)}
          </text>
          <text
            x={WIDTH - PAD.right}
            y={HEIGHT - 8}
            textAnchor="end"
            style={{ font: "400 10px/1 var(--font-mono)", fill: "var(--ink3)" }}
          >
            {shortDate(points[points.length - 1].date)}
          </text>

          {segments(points, (p) => p.cohortPct).map((d) => (
            <path
              key={`cohort-${d}`}
              d={d}
              fill="none"
              stroke="var(--acc2d)"
              strokeWidth="2"
              strokeDasharray="5 3"
              strokeLinecap="round"
            />
          ))}
          {segments(points, (p) => p.studentPct).map((d) => (
            <path
              key={`student-${d}`}
              d={d}
              fill="none"
              stroke="var(--acc)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}

          {hovered && (
            <g>
              <line
                x1={x(hover!, points.length)}
                y1={PAD.top}
                x2={x(hover!, points.length)}
                y2={PAD.top + PLOT_H}
                stroke="var(--ink3)"
                strokeWidth="1"
              />
              {hovered.cohortPct !== null && (
                <circle
                  cx={x(hover!, points.length)}
                  cy={y(hovered.cohortPct)}
                  r="4.5"
                  fill="var(--acc2d)"
                  stroke="var(--pg)"
                  strokeWidth="2"
                />
              )}
              {hovered.studentPct !== null && (
                <circle
                  cx={x(hover!, points.length)}
                  cy={y(hovered.studentPct)}
                  r="4.5"
                  fill="var(--acc)"
                  stroke="var(--pg)"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Below the plot, not floating over it: a tooltip that covers the lines hides the comparison being made. */}
      <div
        className="mt-2"
        style={{
          font: "400 12.5px/1.5 var(--font-mono)",
          color: "var(--ink2)",
          minHeight: 20,
        }}
      >
        {hovered ? (
          <>
            <span style={{ color: "var(--ink3)" }}>{hovered.date}</span>
            {" · "}
            {hovered.studentPct !== null
              ? `${studentName.split(" ")[0]} ${hovered.studentPct}%`
              : `${studentName.split(" ")[0]} —`}
            {" · "}
            {hasCohortLine &&
              (hovered.cohortPct !== null
                ? `class ${hovered.cohortPct}% · `
                : "class — · ")}
            <span style={{ color: "var(--ink3)" }}>
              {hovered.studentAttempts} attempts in window
            </span>
          </>
        ) : (
          <span style={{ color: "var(--ink3)" }}>
            Hover the chart for a day-by-day reading.
          </span>
        )}
      </div>
    </div>
  );
}
