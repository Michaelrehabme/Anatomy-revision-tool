import { useTrackStep } from '../../feedback/useTrackStep';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CLAIM_HREF, CODE_OFFER, codeOfferOpen } from '../../billing/lib/codeOffer';

/**
 * The public home page (CR-028): what the product is, and the shortest way in.
 *
 * Built from the design handoff's LocusMSK Home page, using the app's own
 * tokens rather than the handoff's hardcoded hexes — the palette is already
 * the brand, so a page that repeated the colours literally would drift the
 * first time one changed.
 *
 * CUT DOWN, 28 OCTOBER 2026. The owner found the page too much for a first
 * visit, and signing up the main thing keeping students away. It went from
 * seven sections to four: the access code first (printed openly, the owner's
 * decision), one sample question, one line on prices and three questions.
 * The institutions pitch is now a footer link. While the code is open, every
 * "Claim" goes to /pricing?code=…, which opens on the code and the account
 * step (billing/ClaimCodePanel.tsx). When it ends the banner and the
 * code-first wording come down by themselves (lib/codeOffer.ts) and the page
 * leads with the free area again.
 *
 * THE SAMPLE QUESTION USES REAL PLATES. The four images are the same
 * Z-Anatomy renders the app serves from /anatomy/muscles/ — each muscle's
 * highlight picture at the angle where it shows largest, which is the one its
 * own card opens on — not screenshots or mock-ups. It also means the sample
 * cannot drift from the product: if the renders change, this changes with them.
 *
 * Shown only to a visitor who has not been through onboarding, and only when
 * an admin has switched it on — see data/siteSettings.ts.
 */

const PRICING = {
  monthly: '£4.99',
  annual: '£29.99',
} as const;

/**
 * `angle` is each muscle's PRIMARY frame (musclePlates.generated.ts), named
 * here rather than looked up so the landing page does not pull the plate list
 * in with it. marketingPanels.test.ts fails if a re-render moves or drops one.
 */
export const PANELS = [
  { letter: 'A', id: 'infraspinatus', name: 'Infraspinatus', angle: 210 },
  { letter: 'B', id: 'supraspinatus', name: 'Supraspinatus', angle: 210 },
  { letter: 'C', id: 'subscapularis', name: 'Subscapularis', angle: 0 },
  { letter: 'D', id: 'deltoid', name: 'Deltoid', angle: 270 },
] as const;

/** The highlight plate a sample card shows. */
export const panelSrc = (panel: (typeof PANELS)[number]) =>
  `/anatomy/muscles/${panel.id}-a${String(panel.angle).padStart(3, '0')}-highlight.webp`;

const ANSWER = 'B';

const CONTACT = 'michael@rehabme.uk';

function faqs(codeOpen: boolean) {
  return [
    codeOpen
      ? {
          q: `What happens on ${CODE_OFFER.untilLabel}?`,
          a: 'Your full access ends, and nothing is charged because you never gave a card. You then choose one area to keep for free, for good, and all your progress stays. Subscribe if you want every region back.',
        }
      : {
          q: 'What do I actually get for free?',
          a: 'One full body area of your choosing — every structure in it and every question format. Not a trial: it does not expire, and we do not ask for a card. You can change the area once, after 30 days.',
        },
    {
      q: 'Which courses is it for?',
      a: 'Any course that teaches the musculoskeletal syllabus: physiotherapy, sports therapy, sport rehabilitation, osteopathy, chiropractic and medicine. It covers 122 muscles across nine regions, plus the bones, landmarks, joints and ligaments.',
    },
    {
      q: 'Does it work offline?',
      a: 'Yes. Download an area’s pictures before you set off, and your progress syncs when you are back online.',
    },
  ];
}

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="px-6 py-14 md:py-20">
      <div className="mx-auto" style={{ maxWidth: 1080 }}>
        {children}
      </div>
    </section>
  );
}

function Eyebrow({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div
      id={id}
      style={{
        font: '500 10px/1 var(--font-mono)',
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: 'var(--ink3)',
      }}
    >
      {children}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-3"
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        fontSize: 'clamp(26px, 4vw, 36px)',
        letterSpacing: '-.02em',
        lineHeight: 1.12,
        margin: 0,
        color: 'var(--ink)',
      }}
    >
      {children}
    </h2>
  );
}

function PrimaryLink({ to, children, small }: { to: string; children: React.ReactNode; small?: boolean }) {
  return (
    <Link
      to={to}
      style={{
        font: `500 ${small ? 13.5 : 15}px/1 var(--font-ui)`,
        padding: small ? '9px 14px' : '14px 22px',
        background: 'var(--acc-fill)',
        color: 'var(--onacc)',
        textDecoration: 'none',
        display: 'inline-block',
        borderRadius: 3,
      }}
    >
      {children}
    </Link>
  );
}

function QuietLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        font: '500 15px/1 var(--font-ui)',
        padding: '13px 21px',
        border: '1.2px solid var(--line-strong)',
        color: 'var(--ink)',
        textDecoration: 'none',
        display: 'inline-block',
        borderRadius: 3,
      }}
    >
      {children}
    </Link>
  );
}

function CodeChip() {
  return (
    <span
      style={{
        font: '600 14px/1 var(--font-ui)',
        letterSpacing: '.06em',
        background: 'var(--pg)',
        color: 'var(--ink)',
        border: '1.2px dashed var(--acc)',
        padding: '6px 9px',
        borderRadius: 3,
        whiteSpace: 'nowrap',
      }}
    >
      {CODE_OFFER.code}
    </span>
  );
}

/** Three steps from the home page to a first question, with the code. */
function HowTheCodeWorks() {
  const steps = [
    ['Create an account', 'Use Google, or an email and password.'],
    ['The code is applied for you', 'It is already typed in. Email sign-ups confirm their address first, and the code waits.'],
    ['Start revising straight away', `Every region is open until ${CODE_OFFER.untilLabel}, so there is nothing to choose first. Nothing is charged when it ends.`],
  ];
  return (
    <aside className="rounded-[4px] p-6" style={{ background: 'var(--sf)' }} aria-labelledby="how-code">
      <Eyebrow id="how-code">How the code works</Eyebrow>
      <ol className="mt-4 flex flex-col gap-4" style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
        {steps.map(([title, detail], i) => (
          <li key={title} className="grid gap-3.5" style={{ gridTemplateColumns: '34px minmax(0,1fr)' }}>
            <span
              aria-hidden
              className="grid place-items-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                font: '600 15px/1 var(--font-display)',
                color: 'var(--accd)',
                border: '1.5px solid var(--acc)',
                background: 'var(--pg)',
              }}
            >
              {i + 1}
            </span>
            <div>
              <div style={{ font: '600 16px/1.3 var(--font-ui)', color: 'var(--ink)' }}>{title}</div>
              <div style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>{detail}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 pt-3.5" style={{ borderTop: '1px solid var(--line)', font: '400 13.5px/1.4 var(--font-ui)', color: 'var(--ink3)' }}>
        About a minute with Google.
      </div>
    </aside>
  );
}

function SampleQuestion() {
  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked === ANSWER;

  return (
    <div className="mt-8 p-5" style={{ background: 'var(--sf)', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow>Locate · shoulder &amp; arm</Eyebrow>
        <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--ink3)' }}>Sample 1 / 1</span>
      </div>

      <p className="mt-3" style={{ font: '500 18px/1.35 var(--font-display)', color: 'var(--ink)', margin: '12px 0 0' }}>
        Which panel shows supraspinatus?
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {PANELS.map((panel) => {
          const isAnswer = panel.letter === ANSWER;
          const isPicked = picked === panel.letter;
          // Once answered, the correct panel is always outlined — including
          // when they got it wrong, because being shown the answer is the
          // point of the question, not a consolation.
          const outline = !picked
            ? '1px solid var(--line)'
            : isAnswer
              ? '2.5px solid var(--acc)'
              : isPicked
                ? '2.5px solid var(--acc2)'
                : '1px solid var(--line)';

          return (
            <button
              key={panel.letter}
              type="button"
              onClick={() => setPicked(panel.letter)}
              aria-label={`Panel ${panel.letter}`}
              style={{
                position: 'relative',
                background: 'var(--pg)',
                border: outline,
                padding: 8,
                cursor: picked ? 'default' : 'pointer',
                opacity: picked && !isAnswer && !isPicked ? 0.5 : 1,
              }}
            >
              <img
                src={panelSrc(panel)}
                alt=""
                loading="lazy"
                style={{ width: '100%', display: 'block' }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  left: 6,
                  font: '500 11px/1 var(--font-mono)',
                  color: 'var(--ink3)',
                }}
              >
                {panel.letter}
              </span>
              {picked && (isAnswer || isPicked) && (
                <span
                  className="mt-1 block"
                  style={{
                    font: '500 11px/1.3 var(--font-mono)',
                    color: isAnswer ? 'var(--accd)' : 'var(--acc2d)',
                  }}
                >
                  {panel.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-4" role="status">
          <div style={{ font: `500 15px/1.4 var(--font-ui)`, color: correct ? 'var(--accd)' : 'var(--acc2d)' }}>
            {correct ? 'Correct.' : 'Not quite — B is supraspinatus.'}
          </div>
          <div className="mt-1.5" style={{ font: '400 14px/1.6 var(--font-ui)', color: 'var(--ink2)' }}>
            {correct
              ? 'In the app this now comes back in nine days rather than tomorrow.'
              : 'In the app you would see this one again this evening, and the ones you know would move further away.'}
          </div>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="mt-3"
            style={{ font: '400 13px/1 var(--font-ui)', color: 'var(--ink3)' }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

export function MarketingHome() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  useTrackStep('landing-viewed');
  const codeOpen = codeOfferOpen();
  const questions = faqs(codeOpen);

  return (
    <div style={{ background: 'var(--pg)', minHeight: '100vh' }}>
      {codeOpen && (
        <div style={{ background: 'var(--accs)', borderBottom: '1px solid var(--line)' }}>
          <div
            className="mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2.5 text-center"
            style={{ maxWidth: 1080, font: '400 14.5px/1.45 var(--font-ui)', color: 'var(--ink)' }}
          >
            <span>
              Free full access to every region until <strong>{CODE_OFFER.untilLabel}</strong> with code
            </span>
            <CodeChip />
            <PrimaryLink to={CLAIM_HREF} small>Claim it</PrimaryLink>
          </div>
        </div>
      )}

      <header className="px-6 py-5">
        <div className="mx-auto flex items-center justify-between gap-4" style={{ maxWidth: 1080 }}>
          <span className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" width={26} height={26} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, color: 'var(--ink)' }}>
              Locus<em style={{ fontWeight: 400 }}>MSK</em>
            </span>
          </span>
          <nav className="flex items-center gap-5" style={{ font: '400 14.5px/1 var(--font-ui)' }}>
            {/* The account step is the first thing onboarding shows a visitor. */}
            <Link to="/onboarding" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Sign in</Link>
            <PrimaryLink to={codeOpen ? CLAIM_HREF : '/onboarding'} small>Start free</PrimaryLink>
          </nav>
        </div>
      </header>

      <section className="px-6 pb-12 pt-8 md:pb-16 md:pt-14">
        <div
          className={`mx-auto grid items-center gap-10 ${codeOpen ? 'md:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] md:gap-12' : ''}`}
          style={{ maxWidth: 1080 }}
        >
          <div>
            <Eyebrow>Musculoskeletal anatomy revision</Eyebrow>
            <h1
              className="mt-3"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 'clamp(36px, 6vw, 60px)',
                letterSpacing: '-.03em',
                lineHeight: 1.04,
                margin: 0,
                color: 'var(--ink)',
                maxWidth: 780,
              }}
            >
              Learn every muscle by where it lives.
            </h1>
            <p className="mt-4" style={{ font: '400 17.5px/1.6 var(--font-ui)', color: 'var(--ink2)', maxWidth: 560 }}>
              Answer questions on real anatomical pictures, and the app decides what you see again tomorrow. It covers
              muscles, bones, landmarks, joints and ligaments, region by region.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {codeOpen ? (
                <>
                  <PrimaryLink to={CLAIM_HREF}>Claim free access</PrimaryLink>
                  <QuietLink to="/onboarding">Start free with one area</QuietLink>
                </>
              ) : (
                <PrimaryLink to="/onboarding">Start free</PrimaryLink>
              )}
            </div>
            <p className="mt-4" style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--ink3)' }}>
              No card needed. Or{' '}
              <Link to="/try" style={{ color: 'var(--accd)' }}>try ten questions first</Link>, without signing up.
            </p>
          </div>
          {codeOpen && <HowTheCodeWorks />}
        </div>
      </section>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <Section id="question">
        <Eyebrow>A real question</Eyebrow>
        <Heading>Try one now. No sign-up needed.</Heading>
        <p className="mt-3" style={{ font: '400 16px/1.6 var(--font-ui)', color: 'var(--ink2)', maxWidth: 620 }}>
          These are the pictures the app uses, with the labels hidden.
        </p>
        <SampleQuestion />
        <p className="mt-6" style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
          Want more?{' '}
          <Link to="/try" style={{ color: 'var(--accd)' }}>
            Try ten questions
          </Link>
          , still with no account.
        </p>
      </Section>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <Section id="pricing">
        <div className="flex flex-wrap items-baseline justify-between gap-x-7 gap-y-3">
          <p style={{ font: '400 16px/1.6 var(--font-ui)', color: 'var(--ink2)', maxWidth: 640, margin: 0 }}>
            <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>
              {codeOpen ? 'After the code ends,' : 'One area is free for good.'}
            </strong>{' '}
            {codeOpen ? 'the area you choose stays free for good. ' : ''}
            Every region costs {PRICING.monthly} a month or {PRICING.annual} a year, including VAT. Your progress stays
            either way.
          </p>
          <Link to="/pricing" style={{ font: '400 14.5px/1.4 var(--font-ui)', color: 'var(--accd)' }}>
            See prices
          </Link>
        </div>

        <div className="mt-8" style={{ maxWidth: 760 }}>
          {questions.map((faq, i) => (
            <div key={faq.q} style={{ borderTop: '1px solid var(--line)' }}>
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
                style={{ font: '500 15.5px/1.4 var(--font-ui)', color: 'var(--ink)' }}
              >
                <span>{faq.q}</span>
                <span aria-hidden style={{ color: 'var(--ink3)', font: '400 18px/1 var(--font-mono)' }}>
                  {openFaq === i ? '−' : '+'}
                </span>
              </button>
              {openFaq === i && (
                <p className="pb-4" style={{ font: '400 14.5px/1.65 var(--font-ui)', color: 'var(--ink2)', margin: 0, maxWidth: 640 }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--line)' }} />
        </div>

        <p className="mt-6" style={{ font: '400 13.5px/1.6 var(--font-ui)', color: 'var(--ink3)' }}>
          Anything else, email{' '}
          <a href={`mailto:${CONTACT}`} style={{ color: 'var(--accd)' }}>
            {CONTACT}
          </a>{' '}
          and a person will answer.
        </p>
      </Section>

      <footer className="px-6 py-8" style={{ borderTop: '1px solid var(--line)', background: 'var(--sf)' }}>
        <div className="mx-auto flex flex-wrap items-center justify-between gap-4" style={{ maxWidth: 1080 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
              Locus<em style={{ fontWeight: 400 }}>MSK</em>
            </div>
            <div style={{ font: '400 12.5px/1.4 var(--font-ui)', color: 'var(--ink3)' }}>
              Musculoskeletal anatomy revision
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" style={{ font: '400 13px/1 var(--font-ui)' }}>
            {/* The cohort pitch used to be a whole section; a course lead finds it here. */}
            <a href={`mailto:${CONTACT}?subject=LocusMSK for universities`} style={{ color: 'var(--accd)', textDecoration: 'none', fontWeight: 500 }}>
              For universities
            </a>
            <Link to="/pricing" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Pricing</Link>
            <Link to="/privacy" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Privacy</Link>
            <Link to="/terms" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Terms</Link>
            <Link to="/accessibility" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Accessibility</Link>
            <Link to="/refunds" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Refunds</Link>
            <Link to="/attributions" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Attributions</Link>
            <Link to="/sources" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Sources</Link>
          </nav>
          <div style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>© 2026 LocusMSK</div>
        </div>
      </footer>
    </div>
  );
}
