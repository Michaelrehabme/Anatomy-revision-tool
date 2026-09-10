import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * The public home page (CR-028): what the product is, what it costs, and how
 * an institution buys it.
 *
 * Built from the design handoff's LocusMSK Home page, using the app's own
 * tokens rather than the handoff's hardcoded hexes — the palette is already
 * the brand, so a page that repeated the colours literally would drift the
 * first time one changed.
 *
 * THE SAMPLE QUESTION USES REAL PANELS. The four images are the same
 * Z-Anatomy renders the app serves from /anatomy/panels/, not screenshots or
 * mock-ups. A visitor deciding whether this is worth £29.99 is really asking
 * "what will the questions look like", and the honest answer is to show them
 * one. It also means the sample cannot drift from the product: if the renders
 * change, this changes with them.
 *
 * Shown only to a visitor who has not been through onboarding, and only when
 * an admin has switched it on — see data/siteSettings.ts.
 */

const PRICING = {
  monthly: '£4.99',
  annual: '£29.99',
  annualNote: '£2.50 a month',
} as const;

const PANELS = [
  { letter: 'A', id: 'infraspinatus', name: 'Infraspinatus' },
  { letter: 'B', id: 'supraspinatus', name: 'Supraspinatus' },
  { letter: 'C', id: 'subscapularis', name: 'Subscapularis' },
  { letter: 'D', id: 'deltoid', name: 'Deltoid' },
] as const;

const ANSWER = 'B';

const FAQS = [
  {
    q: 'What do I actually get for free?',
    a: 'One full body area — every muscle in it, all three question branches, streaks and scheduling. Not a trial: it does not expire, and we do not ask for a card.',
  },
  {
    q: 'Which muscles are covered?',
    a: '122 muscles across five regions: shoulder and arm, forearm and hand, back and core, hip and thigh, and lower leg and foot. Questions are built on Z-Anatomy renders with the labels hidden, so what you revise looks like what you will be examined on.',
  },
  {
    q: 'Does it work offline?',
    a: 'Yes. Sessions and images are cached, so a train journey or a basement dissection room is fine. Your progress syncs when you are back online.',
  },
  {
    q: 'Can I cancel?',
    a: 'Monthly stops at the end of the period, no questions asked. Annual is refundable in full within 14 days — after that it runs to the year end.',
  },
  {
    q: 'Is it only for medical students?',
    a: 'No. It is built around the musculoskeletal syllabus shared by physiotherapy, sports therapy, sport rehabilitation, osteopathy and chiropractic — and medicine. Region-first selection means you can drill only what your course examines.',
  },
];

const CONTACT = 'michael@rehabme.uk';

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="px-6 py-16 md:py-24">
      <div className="mx-auto" style={{ maxWidth: 1080 }}>
        {children}
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
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
        fontSize: 'clamp(26px, 4vw, 40px)',
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

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4" style={{ font: '400 16px/1.6 var(--font-ui)', color: 'var(--ink2)', maxWidth: 620 }}>
      {children}
    </p>
  );
}

function PrimaryLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        font: '500 14px/1 var(--font-ui)',
        padding: '13px 20px',
        background: 'var(--acc-fill)',
        color: 'var(--onacc)',
        textDecoration: 'none',
        display: 'inline-block',
      }}
    >
      {children}
    </Link>
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
                src={`/anatomy/panels/${panel.id}.webp`}
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

function PriceCard({
  name,
  price,
  per,
  note,
  features,
  cta,
  emphasis,
}: {
  name: string;
  price: string;
  per?: string;
  note: string;
  features: string[];
  cta: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className="flex flex-col p-6"
      style={{
        background: 'var(--sf)',
        border: emphasis ? '1.6px solid var(--acc)' : '1.2px solid var(--line)',
      }}
    >
      <Eyebrow>{name}</Eyebrow>
      <div className="mt-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        <span style={{ fontSize: 34, fontWeight: 500, letterSpacing: '-.02em' }}>{price}</span>
        {per && <span style={{ fontSize: 15, color: 'var(--ink3)' }}> / {per}</span>}
      </div>
      <p className="mt-2" style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--ink2)', margin: '8px 0 0' }}>
        {note}
      </p>
      <ul className="mt-4 flex flex-1 flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
        {features.map((f) => (
          <li key={f} style={{ font: '400 13.5px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-5">{cta}</div>
    </div>
  );
}

export function MarketingHome() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div style={{ background: 'var(--pg)', minHeight: '100vh' }}>
      <header className="px-6 py-5">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-4" style={{ maxWidth: 1080 }}>
          <span className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" width={26} height={26} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 19, color: 'var(--ink)' }}>
              Locus<em style={{ fontWeight: 400 }}>MSK</em>
            </span>
          </span>
          <nav className="flex flex-wrap items-center gap-5" style={{ font: '400 14px/1 var(--font-ui)' }}>
            <a href="#question" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Try a question</a>
            <a href="#pricing" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Pricing</a>
            <a href="#institutions" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>For institutions</a>
            <PrimaryLink to="/onboarding">Start free</PrimaryLink>
          </nav>
        </div>
      </header>

      <Section>
        <Eyebrow>Musculoskeletal anatomy · revision</Eyebrow>
        <h1
          className="mt-3"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(34px, 6vw, 60px)',
            letterSpacing: '-.03em',
            lineHeight: 1.05,
            margin: 0,
            color: 'var(--ink)',
            maxWidth: 780,
          }}
        >
          Learn every muscle by where it lives.
        </h1>
        <Prose>
          Pick a region, answer real anatomical renders, and let spaced repetition decide what comes back tomorrow.
          122 muscles, three question types, and a body map that shows honestly what is sticking.
        </Prose>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <PrimaryLink to="/onboarding">Start free</PrimaryLink>
          <a href="#question" style={{ font: '400 14px/1 var(--font-ui)', color: 'var(--accd)' }}>
            Try a sample question
          </a>
        </div>
        <div
          className="mt-7 flex flex-wrap gap-x-5 gap-y-2"
          style={{ font: '400 13px/1.4 var(--font-mono)', color: 'var(--ink3)' }}
        >
          <span>One body area free, forever</span>
          <span aria-hidden>·</span>
          <span>No card to start</span>
          <span aria-hidden>·</span>
          <span>Works offline on the train</span>
        </div>
      </Section>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <Section id="question">
        <Eyebrow>A real question</Eyebrow>
        <Heading>Have a go — no sign-up.</Heading>
        <Prose>
          This is the locate branch, using the same renders the app uses with the labels hidden. The other two are
          identify, and OINA — origin, insertion, nerve, action.
        </Prose>
        <SampleQuestion />
      </Section>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <Section id="pricing">
        <Eyebrow>Pricing</Eyebrow>
        <Heading>Cheaper than one textbook.</Heading>
        <Prose>
          Start on one body area for nothing. When you need the whole body, the year works out at about the price of a
          coffee a month.
        </Prose>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          <PriceCard
            name="Free"
            price="£0"
            note="One full body area, free forever. No card, no trial clock."
            features={[
              'Shoulder & arm, or any one region',
              'All three question types',
              'Spaced repetition and streaks',
            ]}
            cta={<PrimaryLink to="/onboarding">Start free</PrimaryLink>}
          />
          <PriceCard
            name="Monthly"
            price={PRICING.monthly}
            per="month"
            note="The whole body, month to month. Cancel whenever."
            features={['All 122 muscles, five regions', 'Full body progress map', 'Offline sessions']}
            cta={
              <a href={`mailto:${CONTACT}?subject=LocusMSK monthly`} style={{ font: '400 14px/1 var(--font-ui)', color: 'var(--accd)' }}>
                Register interest
              </a>
            }
          />
          <PriceCard
            name="Annual · best value"
            price={PRICING.annual}
            per="year"
            note={`${PRICING.annualNote}. Everything in monthly, and it keeps working through resits.`}
            features={['Everything in monthly', 'Exam-countdown planner', 'Keeps working through resits']}
            cta={
              <a href={`mailto:${CONTACT}?subject=LocusMSK annual`} style={{ font: '400 14px/1 var(--font-ui)', color: 'var(--accd)' }}>
                Register interest
              </a>
            }
            emphasis
          />
        </div>

        <p className="mt-5" style={{ font: '400 12.5px/1.6 var(--font-mono)', color: 'var(--ink3)' }}>
          Student card not required — the free area is genuinely free. Paid plans are not open yet; register interest
          and you will hear when they are.
        </p>
      </Section>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <Section id="institutions">
        <Eyebrow>Universities &amp; societies</Eyebrow>
        <Heading>Licence it for the whole year group.</Heading>
        <Prose>
          Course leads, anatomy societies and demonstrators can put LocusMSK in front of a cohort on one invoice — and
          see which regions the year is quietly failing before the OSCE does.
        </Prose>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="p-6" style={{ background: 'var(--sf)', border: '1.2px solid var(--line)' }}>
            <ul className="flex flex-col gap-2.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                'Year-group seats, one invoice',
                'Tutor view of cohort weak spots',
                'Invite a whole cohort by email',
                'Students never share individual answers with staff',
              ].map((item) => (
                <li key={item} style={{ font: '400 14px/1.5 var(--font-ui)', color: 'var(--ink2)' }}>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-4">
              <a
                href={`mailto:${CONTACT}?subject=LocusMSK cohort quote`}
                style={{
                  font: '500 14px/1 var(--font-ui)',
                  padding: '13px 20px',
                  background: 'var(--acc-fill)',
                  color: 'var(--onacc)',
                  textDecoration: 'none',
                }}
              >
                Request a cohort quote
              </a>
              <a
                href={`mailto:${CONTACT}?subject=LocusMSK demo`}
                style={{ font: '400 14px/1 var(--font-ui)', color: 'var(--accd)', alignSelf: 'center' }}
              >
                Book a 15-minute demo
              </a>
            </div>
          </div>

          <div className="p-6" style={{ border: '1.2px solid var(--line)' }}>
            <ul className="flex flex-col gap-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                ['122 muscles', 'five regions, from Z-Anatomy renders'],
                ['3 question types', 'locate, identify and OINA'],
                ['9 min', 'median session — it fits between lectures'],
              ].map(([figure, caption]) => (
                <li key={figure}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: 'var(--ink)' }}>
                    {figure}
                  </div>
                  <div style={{ font: '400 13px/1.4 var(--font-ui)', color: 'var(--ink3)' }}>{caption}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <div style={{ borderTop: '1px solid var(--line)' }} />

      <Section>
        <Eyebrow>Questions</Eyebrow>
        <Heading>Before you start.</Heading>

        <div className="mt-7" style={{ maxWidth: 760 }}>
          {FAQS.map((faq, i) => (
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

      <footer className="px-6 py-10" style={{ borderTop: '1px solid var(--line)', background: 'var(--sf)' }}>
        <div className="mx-auto flex flex-wrap items-center justify-between gap-4" style={{ maxWidth: 1080 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>
              Locus<em style={{ fontWeight: 400 }}>MSK</em>
            </div>
            <div style={{ font: '400 12.5px/1.4 var(--font-ui)', color: 'var(--ink3)' }}>
              Musculoskeletal anatomy revision
            </div>
          </div>
          <nav className="flex flex-wrap gap-5" style={{ font: '400 13px/1 var(--font-ui)' }}>
            <a href="#pricing" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Pricing</a>
            <a href="#institutions" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Institutions</a>
            <Link to="/privacy" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Privacy</Link>
            <Link to="/terms" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Terms</Link>
            <Link to="/attributions" style={{ color: 'var(--ink2)', textDecoration: 'none' }}>Attributions</Link>
          </nav>
          <div style={{ font: '400 12px/1 var(--font-mono)', color: 'var(--ink3)' }}>© 2026 LocusMSK</div>
        </div>
      </footer>
    </div>
  );
}
