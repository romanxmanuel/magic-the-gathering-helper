import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="launcher-hero">
        <div className="launcher-hero-grid">
          <div className="launcher-copy">
            <p className="eyebrow">Dual TCG Deck Lab</p>
            <h1>Choose your game, build sharper lists, and print clean playtest proxies.</h1>
            <p className="hero-description">
              Card Lab gives Magic and Yu-Gi-Oh their own dedicated builder flows inside one polished shell. Each game
              keeps separate logic, tuning controls, and print behavior so the experience feels native instead of
              mashed together.
            </p>
            <div className="status-row">
              <span className="status-pill">MTG fully live</span>
              <span className="status-pill">Yu-Gi-Oh live now</span>
              <span className="status-pill">Print studios ready</span>
            </div>
          </div>

          <aside className="launcher-sidecar">
            <p className="panel-kicker">What feels better here</p>
            <div className="launcher-sidecar-list">
              <article className="summary-card launcher-sidecar-card">
                <strong>Separate game brains</strong>
                <small>Commander logic stays in MTG. Archetype and anti-meta tuning stay in Yu-Gi-Oh.</small>
              </article>
              <article className="summary-card launcher-sidecar-card">
                <strong>Print-first workflow</strong>
                <small>Both products are built around actual playtesting, not just list generation.</small>
              </article>
              <article className="summary-card launcher-sidecar-card">
                <strong>Explainable output</strong>
                <small>You can tweak lists manually without losing the reasoning behind the shell.</small>
              </article>
            </div>
            <div className="tag-row launcher-sidecar-actions">
              <Link href="/mtg" className="primary-button">
                Start in MTG
              </Link>
              <Link href="/yugioh" className="ghost-button">
                Open Yu-Gi-Oh
              </Link>
            </div>
          </aside>
        </div>

        <div className="launcher-grid">
          <Link href="/mtg" className="launcher-card launcher-card-mtg">
            <div className="launcher-card-copy">
              <p className="panel-kicker">Magic: The Gathering</p>
              <h2>Commander Lab</h2>
              <p>
                Build 100-card Commander shells, tune them with meta context, and print full proxy sheets for
                playtesting.
              </p>
            </div>
            <ul className="launcher-feature-list">
              <li>Commander-first workflow</li>
              <li>Meta-backed tuning</li>
              <li>Print-ready proxy sheets</li>
            </ul>
            <span className="launcher-card-cta">Open MTG builder</span>
          </Link>

          <Link href="/yugioh" className="launcher-card launcher-card-yugioh">
            <div className="launcher-card-copy">
              <p className="panel-kicker">Yu-Gi-Oh!</p>
              <h2>Duel Forge</h2>
              <p>
                Theme-first shell building for archetypes like Yubel, Sky Striker, and Tenpai, with explainable tuning,
                rebuild paths, and proxy-ready print output.
              </p>
            </div>
            <ul className="launcher-feature-list">
              <li>Meta-powered shell generation</li>
              <li>Explainable structure scoring</li>
              <li>Quick rebuild and print flow</li>
            </ul>
            <span className="launcher-card-cta">Open Duel Forge</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
