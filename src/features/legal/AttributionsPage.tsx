import { ALL_IMAGES } from '../anatomy-revision/data/seed';
import { LegalLayout, legalHeading, legalLabel, legalProse } from './LegalLayout';
import { OSS_LICENCES } from './data/ossLicences.generated';

/**
 * /attributions — required by CR-025 item 7.
 *
 * CC BY-SA 4.0 obliges attribution and same-licence redistribution, and a
 * licence string rendered on a badge beside one image (AttributionBadge) is
 * not sufficient on its own for a shipped commercial product: the obligation
 * is a findable, complete notice. This is that notice.
 *
 * Every count and grouping is DERIVED from ALL_IMAGES rather than written
 * down. As CR-026 replaces the AI illustrations with Z-Anatomy renders, this
 * page follows on its own — a hardcoded "36 of 50" would quietly become a
 * false statement about licensing, which is the one thing this page cannot be.
 */

const CC_BY_SA = 'https://creativecommons.org/licenses/by-sa/4.0/';
const Z_ANATOMY = 'https://github.com/Z-Anatomy/Models-of-human-anatomy';

interface Group {
  credit: string;
  licence: string;
  images: typeof ALL_IMAGES;
}

function groupImages(): Group[] {
  const groups = new Map<string, Group>();

  for (const image of ALL_IMAGES) {
    const key = `${image.credit}::${image.licence}`;
    const existing = groups.get(key);
    if (existing) existing.images.push(image);
    else groups.set(key, { credit: image.credit, licence: image.licence, images: [image] });
  }

  return [...groups.values()].sort((a, b) => b.images.length - a.images.length);
}

export function AttributionsPage() {
  const groups = groupImages();

  return (
    <LegalLayout title="Attributions and licences" updated="9 September 2026">
      <p className="mt-4" style={legalProse}>
        This app is built on work by other people. Everything below says who made what, and under which licence it is
        used and may be reused.
      </p>

      <section className="mt-9">
        <h2 style={legalHeading}>Anatomical imagery</h2>
        <p className="mt-2" style={legalProse}>
          Most anatomical renders in this app are derived from{' '}
          <a href={Z_ANATOMY} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accd)' }}>
            Z-Anatomy
          </a>{' '}
          (Gauthier Kervyn and contributors), itself based on BodyParts3D by the Database Center for Life Science. They
          are licensed{' '}
          <a href={CC_BY_SA} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accd)' }}>
            Creative Commons Attribution-ShareAlike 4.0
          </a>
          .
        </p>
        <p className="mt-3" style={legalProse}>
          These images remain under CC BY-SA 4.0 here. Anyone may redistribute or adapt them under the same licence,
          with attribution — including images that have been cropped, recoloured or annotated for this app. That applies
          to the imagery only; the question bank, scheduling and analytics in this app are not covered by it.
        </p>
      </section>

      <section className="mt-9">
        <h2 style={legalHeading}>Muscle dataset</h2>
        <p className="mt-2" style={legalProse}>
          Origin, insertion, nerve supply and action data for the 122 muscles derives from
          &ldquo;ALL_Muscles_of_the_body&rdquo; by Vinnie Maynard, University of Salford, cross-referenced against
          Terminologia Anatomica (TA2) identifiers.
        </p>
      </section>

      <section className="mt-9">
        <h2 style={legalHeading}>Every image</h2>
        <p className="mt-2" style={legalProse}>
          All {ALL_IMAGES.length} images currently shipped, grouped by source.
        </p>

        {groups.map((group) => (
          <div key={`${group.credit}::${group.licence}`} className="mt-6">
            <div style={legalLabel}>
              {group.images.length} {group.images.length === 1 ? 'image' : 'images'} · {group.licence}
            </div>
            <p className="mt-1.5" style={{ ...legalProse, color: 'var(--ink)' }}>
              {group.credit}
            </p>
            <ul className="mt-2 flex list-none flex-col gap-0.5 p-0">
              {group.images
                .map((image) => image.filePath)
                .sort()
                .map((filePath) => (
                  <li key={filePath} className="break-all" style={{ font: '400 12px/1.5 var(--font-mono)', color: 'var(--ink3)' }}>
                    {filePath}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-9">
        <h2 style={legalHeading}>Open-source software</h2>
        <p className="mt-2" style={legalProse}>
          Direct runtime dependencies and their declared licences. Full licence texts are distributed with each package.
        </p>
        <ul className="mt-3 flex list-none flex-col gap-1 p-0">
          {OSS_LICENCES.map((dep) => (
            <li key={dep.name} style={{ font: '400 13px/1.5 var(--font-mono)', color: 'var(--ink2)' }}>
              {dep.name} {dep.version} — {dep.licence}
            </li>
          ))}
        </ul>
      </section>
    </LegalLayout>
  );
}

export default AttributionsPage;
