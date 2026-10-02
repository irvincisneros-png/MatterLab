import { ArrowRight, Atom, Beaker, Droplets, Layers3, Sparkles, Waves } from 'lucide-react';
import { OUTCOMES, OUTCOME_SHORT_TITLES, routeForOutcome, SYLLABUS_SECTIONS, type OutcomeId } from '../content/outcomes';
import './SyllabusMenu.css';

const SECTION_ICONS = {
  '4.1': Atom,
  '4.2': Droplets,
  '4.3': Beaker,
  '4.4': Layers3,
  '4.5': Waves,
} as const;

function activityLinks(outcome: OutcomeId) {
  if (outcome === '4.1.1') return [
    { outcome: '4.1.1' as const, href: routeForOutcome('4.1.1'), label: 'Explore the water cycle' },
    { outcome: '4.1.4' as const, href: routeForOutcome('4.1.4'), label: 'Compare the three states' },
  ];
  return [{ outcome, href: routeForOutcome(outcome), label: 'Open this lesson' }];
}

export function SyllabusMenu() {
  return (
    <section className="syllabus-menu" aria-labelledby="syllabus-title">
      <header className="syllabus-hero">
        <div className="syllabus-hero-copy">
          <p className="syllabus-eyebrow"><span>MATTERLAB</span><i /> YEAR 7 SCIENCE</p>
          <h1 id="syllabus-title">Term 4 syllabus</h1>
          <p>Choose a syllabus dot point to open its simulation or virtual investigation. Choose one activity or combine linked activities for your lesson.</p>
        </div>
        <div className="syllabus-hero-art" aria-hidden="true">
          <span className="syllabus-orbit orbit-a" />
          <span className="syllabus-orbit orbit-b" />
          <span className="syllabus-atom nucleus" />
          <span className="syllabus-orb orb-blue" />
          <span className="syllabus-orb orb-coral" />
          <span className="syllabus-orb orb-gold" />
          <Atom size={26} />
        </div>
      </header>

      <nav className="syllabus-section-jump" aria-label="Syllabus sections">
        {SYLLABUS_SECTIONS.map((section) => <a key={section.id} href={`#syllabus-${section.id}`}><span>{section.id}</span>{section.title}</a>)}
      </nav>

      <div className="syllabus-sections">
        {SYLLABUS_SECTIONS.map((section) => {
          const Icon = SECTION_ICONS[section.id];
          return <section className={`syllabus-group syllabus-group-${section.id.replace('.', '-')}`} id={`syllabus-${section.id}`} key={section.id} aria-labelledby={`syllabus-heading-${section.id}`}>
            <header className="syllabus-group-heading">
              <span className="syllabus-group-icon"><Icon size={19} /></span>
              <div><p>{section.id} · TERM 4</p><h2 id={`syllabus-heading-${section.id}`}>{section.title}</h2></div>
            </header>
            <div className="syllabus-card-grid">
              {section.outcomes.map((outcome, index) => <article className="syllabus-card" key={outcome}>
                <div className="syllabus-card-top"><span className="syllabus-outcome-number">{outcome}</span><span className="syllabus-order">{String(index + 1).padStart(2, '0')}</span></div>
                <h3>{OUTCOME_SHORT_TITLES[outcome]}</h3>
                <p className="syllabus-wording">{OUTCOMES[outcome].wording}</p>
                {outcome === '4.2.3' && <p className="syllabus-formula" aria-label="Density formula">ρ = mass ÷ volume</p>}
                <p className="syllabus-activity-note">{OUTCOMES[outcome].focus}</p>
                <div className="syllabus-activities">
                  {activityLinks(outcome).map((activity) => <a href={activity.href} key={`${outcome}-${activity.href}`} aria-label={`Open ${activity.outcome} ${OUTCOME_SHORT_TITLES[activity.outcome]}: ${activity.label}`}>
                    <span>{activity.label}</span><ArrowRight size={15} />
                  </a>)}
                </div>
              </article>)}
            </div>
          </section>;
        })}
      </div>

      <section className="syllabus-extras" aria-labelledby="optional-examples-heading">
        <div className="syllabus-extra-mark"><Sparkles size={19} /></div>
        <div className="syllabus-extra-copy"><span>OPTIONAL EXTENSIONS · NOT NUMBERED SYLLABUS OUTCOMES</span><h2 id="optional-examples-heading">Atomic examples beyond the core lessons</h2><p>Explore hydrogen plasma or an ultracold rubidium-87 gas as separate examples of matter.</p></div>
        <div className="syllabus-extra-links"><a href="#/advanced/plasma">Hydrogen plasma <ArrowRight size={15} /></a><a href="#/advanced/bec">Bose–Einstein condensate <ArrowRight size={15} /></a></div>
      </section>

      <footer className="syllabus-footer">Follow the sequence or jump straight to the activity you need.</footer>
    </section>
  );
}
