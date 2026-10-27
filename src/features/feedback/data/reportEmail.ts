import { REPORT_REASONS, type QuestionReport } from './rows';
import { AREA_LABELS, REGION_LABELS } from '../../anatomy-revision/types/region';

/**
 * The email the owner gets for each question a student reports (owner, 24
 * Oct 2026: "then I don't have to check in admin mode for any of the
 * issues"). Sent by netlify/functions/report-emails.ts; built here, with no
 * network, so the wording is tested.
 *
 * 25 Oct 2026 (owner: "quite bland"; "include the screen/question that was
 * shown"): an HTML email in the site's colours, with a plain-text twin, that
 * leads with what the student said and then shows the question as they saw
 * it — the prompt, its picture, the choices with the right one and theirs
 * marked. Who sent it is named when the function can look them up; a report
 * from before the snapshot existed falls back to the ids.
 */

export const SITE = 'https://locusmsk.co.uk';
export const ADMIN_FEEDBACK_URL = `${SITE}/admin/feedback`;

export function reasonLabel(reason: string): string {
  return REPORT_REASONS.find((r) => r.id === reason)?.label ?? reason;
}

export interface Reporter {
  name?: string;
  email?: string;
}

const QUESTION_TYPES: Record<string, string> = {
  mcq: 'Multiple choice',
  'identify-typed': 'Typed answer',
  locate: 'Tap the structure',
  'fill-blank': 'Fill the blank',
  'multi-select': 'Choose all that apply',
  flashcard: 'Card',
  oina: 'Muscle facts',
};

/** 'ankle-foot' -> 'Ankle foot'; a structure id the same way. */
function words(id: string | null | undefined): string {
  if (!id) return '';
  const s = id.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function pictureUrl(path: string): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE}/${path.replace(/^\/+/, '')}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const split = (s: string | undefined) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);

function reporterLine(reporter: Reporter | undefined, report: QuestionReport): string {
  const name = reporter?.name?.trim();
  const email = reporter?.email?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || `Student ${report.userId}`;
}

export function reportEmail(report: QuestionReport, reporter?: Reporter): { subject: string; text: string; html: string } {
  const reason = reasonLabel(report.reason);
  const note = report.note.trim();
  const shown = report.shown;
  const subjectName = shown?.subject || words(report.structureId);
  const who = reporterLine(reporter, report);
  const firstName = reporter?.name?.trim().split(/\s+/)[0];
  const subject = `${firstName ? `${firstName} reported` : 'Report:'} ${subjectName} — ${reason}`;
  const kind = QUESTION_TYPES[report.questionType] ?? report.questionType;
  const area = (AREA_LABELS as Record<string, string>)[report.area ?? ''] ?? (REGION_LABELS as Record<string, string>)[report.area ?? ''] ?? (words(report.area) || '—');
  const lines = split(shown?.lines);
  const choices = split(shown?.choices);
  const correct = shown?.correct ?? '';
  const given = shown?.given ?? '';
  const pic = pictureUrl(shown?.picture ?? '');

  // ---- plain text ----
  const text = [
    `${reason}`,
    `From ${who}, ${when(report.createdAt)}`,
    ...(note ? ['', `"${note}"`] : []),
    '',
    `${subjectName} · ${area} · ${kind}`,
    ...(shown
      ? [
          '',
          'What they saw',
          shown.prompt,
          ...lines.map((l) => `  • ${l}`),
          ...(choices.length
            ? ['', ...choices.map((c) => `  ${c === correct ? '✓' : ' '} ${c}${c === given ? '   ← their answer' : ''}`)]
            : []),
          ...(correct && !choices.includes(correct) ? [`Right answer: ${correct}`] : []),
          ...(given && !choices.includes(given) ? [`Their answer: ${given}`] : []),
          ...(pic ? [`Picture: ${pic}`] : []),
        ]
      : []),
    '',
    `Resolve it: ${ADMIN_FEEDBACK_URL}`,
    '',
    `Question ${report.questionId} · build ${report.build} · student ${report.userId}`,
  ].join('\n');

  // ---- HTML ----
  const C = { ink: '#1f2a44', ink2: '#46505f', ink3: '#5d6779', acc: '#3f8f8a', accFill: '#34756f', sf: '#efe9da', bg: '#f7f4ec', line: '#ddd6c6', err: '#8f332e' };
  const font = "font-family:'Hanken Grotesk',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const chip = (t: string) => `<span style="display:inline-block;padding:3px 8px;margin:0 6px 6px 0;border-radius:3px;background:${C.sf};color:${C.ink2};font-size:12px;">${esc(t)}</span>`;
  const choiceRows = choices
    .map((c) => {
      const isRight = c === correct;
      const isTheirs = given && c === given;
      const mark = isRight ? '&#10003;' : isTheirs ? '&#10007;' : '&nbsp;';
      const markColour = isRight ? C.accFill : C.err;
      const border = isRight ? C.acc : isTheirs ? C.err : C.line;
      const tag = isTheirs ? `<span style="float:right;font-size:12px;color:${isRight ? C.accFill : C.err};">their answer</span>` : '';
      return `<tr><td style="padding:4px 0;"><div style="border:1.2px solid ${border};border-radius:3px;padding:9px 11px;color:${C.ink};font-size:14px;">${tag}<span style="display:inline-block;width:18px;color:${markColour};font-weight:600;">${mark}</span>${esc(c)}</div></td></tr>`;
    })
    .join('');
  const answerRows = [
    correct && !choices.includes(correct) ? `<p style="margin:10px 0 0;font-size:14px;color:${C.ink};"><span style="color:${C.ink3};">Right answer</span><br><strong>${esc(correct).replace(/\n/g, '<br>')}</strong></p>` : '',
    given && !choices.includes(given) ? `<p style="margin:10px 0 0;font-size:14px;color:${C.err};"><span style="color:${C.ink3};">Their answer</span><br><strong>${esc(given)}</strong></p>` : '',
  ].join('');
  const saw = shown
    ? `<tr><td style="padding:22px 28px 6px;">
  <p style="margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.ink3};">What they saw</p>
  <div style="border:1px solid ${C.line};border-radius:4px;padding:16px;background:#ffffff;">
    <p style="margin:0;font-size:16px;line-height:1.4;font-weight:600;color:${C.ink};">${esc(shown.prompt)}</p>
    ${lines.length ? `<ul style="margin:8px 0 0;padding-left:20px;color:${C.ink2};font-size:14px;line-height:1.5;">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    ${pic ? `<img src="${esc(pic)}" alt="The picture shown with the question" width="440" style="display:block;width:100%;max-width:440px;height:auto;margin:14px auto 0;border-radius:3px;background:${C.sf};">` : ''}
    ${choiceRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${choiceRows}</table>` : ''}
    ${answerRows}
  </div>
</td></tr>`
    : `<tr><td style="padding:18px 28px 0;font-size:13px;color:${C.ink3};">Sent before reports carried the question itself: question <code>${esc(report.questionId)}</code>.</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};${font}"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${C.line};border-radius:6px;overflow:hidden;">
<tr><td style="background:${C.ink};padding:14px 28px;color:#f3eee2;font-size:13px;letter-spacing:.06em;">LOCUS<span style="color:#5cb8b0;">MSK</span> &nbsp;·&nbsp; Question report</td></tr>
<tr><td style="padding:24px 28px 0;">
  <p style="margin:0;font-size:22px;line-height:1.25;font-weight:600;color:${C.ink};">${esc(reason)}</p>
  <p style="margin:8px 0 0;font-size:14px;color:${C.ink2};">From <strong style="color:${C.ink};">${esc(who)}</strong> &middot; ${esc(when(report.createdAt))}</p>
  <div style="margin-top:12px;">${chip(subjectName)}${chip(area)}${chip(kind)}</div>
</td></tr>
${note ? `<tr><td style="padding:14px 28px 0;"><div style="border-left:3px solid ${C.acc};background:${C.sf};padding:12px 14px;font-size:15px;line-height:1.5;color:${C.ink};font-style:italic;">&ldquo;${esc(note)}&rdquo;</div></td></tr>` : ''}
${saw}
<tr><td style="padding:22px 28px 26px;">
  <a href="${ADMIN_FEEDBACK_URL}" style="display:inline-block;background:${C.accFill};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:3px;">Resolve in admin</a>
</td></tr>
<tr><td style="padding:12px 28px 18px;border-top:1px solid ${C.line};font-size:11.5px;line-height:1.6;color:${C.ink3};">
  Question ${esc(report.questionId)}<br>Build ${esc(report.build)} &middot; student ${esc(report.userId)}
</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}
