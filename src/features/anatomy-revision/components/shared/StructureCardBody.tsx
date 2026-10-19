import { Link } from 'react-router-dom';
import type { AnatomyStructure } from '../../types/structure';
import type { AnatomyImageAsset } from '../../types/image';
import type { StructureIndexEntry } from '../../types/structureIndex';
import { atlasCardSections } from '../../lib/atlasFacts';
import { rotationFramesFor } from '../../lib/rotationFrames';
import { STRUCTURE_SOURCES } from '../../data/structureSources.generated';
import { WORKS } from '../../../legal/data/provenance.generated';
import { BloodSupplyFacts } from './BloodSupplyFacts';
import { RichText } from './RichText';
import { ImageViewer } from './ImageViewer';
import { PromptHighlightOverlay } from './PromptHighlightOverlay';
import { LigamentPictureNote, isLigamentPlate } from './LigamentPictureNote';

const LABEL_STYLE = { font: '500 10px/1 var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink3)' } as const;

/**
 * The picture at the top of a structure's card: the one the quiz shows, which
 * a student can zoom into and turn through its angles (ImageViewer).
 *
 * A ligament's picture is shown with a note that it is rough (owner, 18 Oct
 * 2026): its pictures were taken out of the questions as not good enough, but
 * still help a student see where it lies.
 */
export function StructurePicture({ structure, images, compact = false }: {
  structure: AnatomyStructure | StructureIndexEntry;
  images: readonly AnatomyImageAsset[];
  compact?: boolean;
}) {
  const box = { background: 'var(--fig-off)', color: 'var(--ink3)' } as const;
  const blank = (text: string) => (
    <div className={`flex items-center justify-center rounded-[3px] px-6 text-center ${compact ? 'min-h-[120px]' : 'min-h-[220px]'}`} style={box}>
      {text}
    </div>
  );
  const own = images.filter((img) => img.mode === 'single-structure' && img.structureId === structure.id);
  // Muscle plates are listed primary angle first (images.seed.ts).
  const image = own[0];
  if (!image) return blank('No image yet');
  const frames = rotationFramesFor(image, images);
  return (
    <div>
      <div className="overflow-hidden rounded-[3px]" style={{ background: 'var(--fig-off)' }}>
        {/* The viewer prints the picture's credit itself. */}
        <ImageViewer
          image={image}
          frames={frames}
          subjectId={structure.id}
          resetKey={structure.id}
          // A landmark or joint panel is a plain skeleton with its target stored
          // beside it: drawn here, as the quiz draws it, or the card shows an
          // unmarked bone. Pre-highlighted pictures carry no hotspot and are untouched.
          overlay={(current) => <PromptHighlightOverlay image={current} structureId={structure.id} />}
        />
      </div>
      {isLigamentPlate(image) && <LigamentPictureNote compact={compact} />}
    </div>
  );
}

/** A list of works as the card prints them: names, linked where there is a page. */
function WorkList({ works }: { works: readonly number[] }) {
  return (
    <>
      {works.map((w, i) => {
        const work = WORKS[w];
        if (!work) return null;
        return (
          <span key={w}>
            {i > 0 && '; '}
            {work.url ? (
              <a href={work.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accd)' }}>
                {work.title}
              </a>
            ) : (
              work.title
            )}
          </span>
        );
      })}
    </>
  );
}

/**
 * What this structure's facts were checked against (owner, 17 Oct 2026:
 * sources on the card). The works are the publishers /sources names, read
 * from the same review files (structureSources.generated.ts); the quote
 * behind each fact stays in those files.
 */
export function StructureSources({ structureId, compact = false }: { structureId: string; compact?: boolean }) {
  const [facts = [], blood = []] = STRUCTURE_SOURCES[structureId] ?? [];
  return (
    <div className={compact ? 'py-3.5' : 'py-4.5'}>
      <div style={LABEL_STYLE}>Sources</div>
      <div className={`mt-2 flex flex-col gap-1.5 ${compact ? 'text-[14px]' : 'text-[15px]'} leading-relaxed`} style={{ color: 'var(--ink2)' }}>
        {facts.length > 0 ? (
          <p>
            <span style={{ color: 'var(--ink3)' }}>Facts checked against · </span>
            <WorkList works={facts} />
          </p>
        ) : (
          <p>Not yet checked against a named source.</p>
        )}
        {blood.length > 0 && (
          <p>
            <span style={{ color: 'var(--ink3)' }}>Blood supply · </span>
            <WorkList works={blood} />
          </p>
        )}
        <p>
          <Link to="/sources" style={{ color: 'var(--accd)' }}>
            How the content is checked
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * The facts on a structure's card, every kind alike: the sections from
 * lib/atlasFacts, the blood supply before the clinical note, then the sources.
 */
export function StructureCardFacts({ structure, byId, compact = false }: {
  structure: AnatomyStructure;
  byId: ReadonlyMap<string, StructureIndexEntry>;
  compact?: boolean;
}) {
  const sections = atlasCardSections(structure, byId);
  const clinical = sections.filter((s) => s.label === 'Clinical note');
  const section = ({ label, items }: { label: string; items: string[] }) => (
    <div key={label} className={compact ? 'py-3.5' : 'py-4.5'}>
      <div style={LABEL_STYLE}>{label}</div>
      <RichText
        className={compact ? 'mt-1.5 text-base leading-relaxed' : 'mt-2 max-w-[56ch] text-lg leading-relaxed'}
        text={items.length > 1 ? items.map((item) => `• ${item}`).join('\n') : items[0]}
      />
    </div>
  );
  return (
    <div className="flex flex-col">
      {sections.filter((s) => s.label !== 'Clinical note').map(section)}
      <BloodSupplyFacts structure={structure} compact={compact} />
      {clinical.map(section)}
      <StructureSources structureId={structure.id} compact={compact} />
    </div>
  );
}

/** "Drill this ligament": the button names what the card is about. */
export function drillLabel(structure: Pick<StructureIndexEntry, 'category'>): string {
  return `Drill this ${structure.category}`;
}
