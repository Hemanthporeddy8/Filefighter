/* src/components/seo/ToolSeoPage.tsx
   Reusable SEO landing page shell for every Editroy tool.
   Used by server components so metadata is rendered properly.
*/
import type { ToolSeoMeta } from '@/lib/seo';

interface Props {
  tool: ToolSeoMeta;
}

export function ToolSeoPage({ tool }: Props) {
  /* ── JSON-LD structured data ── */
  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.appName,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web Browser',
    url: tool.canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: tool.description,
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: tool.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="tool-seo-page">

        {/* ── Hero ── */}
        <section className="tseo-hero">
          <div className="tseo-hero-inner">
            <h1 className="tseo-h1">{tool.h1}</h1>
            <p className="tseo-tagline">{tool.tagline}</p>
            <ul className="tseo-features">
              {tool.features.map((f, i) => (
                <li key={i}><span className="tseo-check">✓</span> {f}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Tool Iframe ── */}
        <section className="tseo-tool-wrapper" aria-label={`${tool.appName} — interactive tool`}>
          <iframe
            src={tool.iframeSrc}
            title={tool.appName}
            className="tseo-iframe"
            style={{ height: `${tool.iframeHeight ?? 800}px` }}
            loading="eager"
            allow="camera; microphone; clipboard-write; autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-popups allow-modals"
          />
        </section>

        {/* ── How it works ── */}
        <section className="tseo-section" id="how-it-works">
          <div className="tseo-container">
            <h2 className="tseo-section-title">How It Works</h2>
            <div className="tseo-steps">
              {tool.howItWorks.map((step, i) => (
                <div className="tseo-step" key={i}>
                  <div className="tseo-step-num">{i + 1}</div>
                  <div className="tseo-step-icon">{step.icon}</div>
                  <h3 className="tseo-step-heading">{step.heading}</h3>
                  <p className="tseo-step-body">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="tseo-section tseo-faq-section" id="faq">
          <div className="tseo-container">
            <h2 className="tseo-section-title">Frequently Asked Questions</h2>
            <div className="tseo-faqs">
              {tool.faqs.map((faq, i) => (
                <details className="tseo-faq-item" key={i}>
                  <summary className="tseo-faq-q">{faq.question}</summary>
                  <p className="tseo-faq-a">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Related Tools ── */}
        <section className="tseo-section tseo-related-section">
          <div className="tseo-container">
            <h2 className="tseo-section-title">More Free Tools</h2>
            <div className="tseo-related-grid">
              {tool.relatedTools.map((rt, i) => (
                <a href={rt.href} key={i} className="tseo-related-card">
                  <span className="tseo-related-icon">{rt.icon}</span>
                  <span className="tseo-related-label">{rt.label}</span>
                  <span className="tseo-related-arrow">→</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="tseo-footer">
          <div className="tseo-container">
            <p>
              © {new Date().getFullYear()} <a href="https://www.editroy.com">Editroy</a> — Free creator tools. 
              Private by design. No signup required.
            </p>
          </div>
        </footer>
      </div>

      {/* ── Inline styles (self-contained, no Tailwind needed) ── */}
      <style>{`
        /* Reset & base */
        .tool-seo-page {
          --accent: #c8f135;
          --accent2: #7fff6e;
          --bg: #0a0a0a;
          --surface: #141414;
          --surface2: #1c1c1c;
          --border: rgba(255,255,255,0.08);
          --text: #f0f0f0;
          --muted: rgba(240,240,240,0.55);
          font-family: 'Inter', 'DM Sans', system-ui, sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
        }

        /* Hero */
        .tseo-hero {
          background: linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0f0a 100%);
          padding: clamp(48px, 8vw, 96px) 24px clamp(32px, 5vw, 64px);
          text-align: center;
          border-bottom: 1px solid var(--border);
        }
        .tseo-hero-inner { max-width: 720px; margin: 0 auto; }
        .tseo-h1 {
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 800;
          line-height: 1.1;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 16px;
        }
        .tseo-tagline {
          font-size: clamp(1rem, 2.5vw, 1.25rem);
          color: var(--muted);
          margin: 0 0 28px;
          line-height: 1.6;
        }
        .tseo-features {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 10px 20px;
          justify-content: center;
        }
        .tseo-features li {
          font-size: 0.9rem;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tseo-check {
          color: var(--accent);
          font-weight: 700;
          font-size: 1rem;
        }

        /* Tool wrapper */
        .tseo-tool-wrapper {
          width: 100%;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .tseo-iframe {
          display: block;
          width: 100%;
          border: none;
          min-height: 700px;
        }

        /* Generic section */
        .tseo-section { padding: clamp(48px, 7vw, 96px) 24px; }
        .tseo-container { max-width: 900px; margin: 0 auto; }
        .tseo-section-title {
          font-size: clamp(1.5rem, 3vw, 2.2rem);
          font-weight: 700;
          text-align: center;
          margin: 0 0 48px;
          color: var(--text);
        }

        /* Steps */
        .tseo-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 28px;
        }
        .tseo-step {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px 24px;
          text-align: center;
          transition: border-color 0.2s, transform 0.2s;
        }
        .tseo-step:hover {
          border-color: rgba(200, 241, 53, 0.3);
          transform: translateY(-4px);
        }
        .tseo-step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px; height: 28px;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          color: #0a0a0a;
          font-weight: 800;
          font-size: 0.8rem;
          border-radius: 50%;
          margin-bottom: 12px;
        }
        .tseo-step-icon { font-size: 2rem; margin-bottom: 12px; display: block; }
        .tseo-step-heading { font-size: 1.05rem; font-weight: 700; margin: 0 0 8px; }
        .tseo-step-body { font-size: 0.9rem; color: var(--muted); margin: 0; line-height: 1.6; }

        /* FAQ */
        .tseo-faq-section { background: var(--surface); }
        .tseo-faqs { display: flex; flex-direction: column; gap: 12px; }
        .tseo-faq-item {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .tseo-faq-item[open] { border-color: rgba(200, 241, 53, 0.25); }
        .tseo-faq-q {
          padding: 18px 20px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          list-style: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          user-select: none;
        }
        .tseo-faq-q::-webkit-details-marker { display: none; }
        .tseo-faq-q::after {
          content: '+';
          font-size: 1.4rem;
          color: var(--accent);
          flex-shrink: 0;
          transition: transform 0.2s;
        }
        .tseo-faq-item[open] .tseo-faq-q::after { transform: rotate(45deg); }
        .tseo-faq-a {
          padding: 0 20px 18px;
          margin: 0;
          color: var(--muted);
          font-size: 0.95rem;
          line-height: 1.7;
        }

        /* Related tools */
        .tseo-related-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }
        .tseo-related-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px 20px;
          text-decoration: none;
          color: var(--text);
          transition: border-color 0.2s, transform 0.2s, background 0.2s;
          font-size: 0.95rem;
          font-weight: 600;
        }
        .tseo-related-card:hover {
          border-color: var(--accent);
          background: rgba(200, 241, 53, 0.05);
          transform: translateY(-2px);
        }
        .tseo-related-icon { font-size: 1.4rem; flex-shrink: 0; }
        .tseo-related-label { flex: 1; }
        .tseo-related-arrow { color: var(--accent); font-size: 1.1rem; }

        /* Footer */
        .tseo-footer {
          border-top: 1px solid var(--border);
          padding: 28px 24px;
          text-align: center;
          color: var(--muted);
          font-size: 0.85rem;
        }
        .tseo-footer a { color: var(--accent); text-decoration: none; }
        .tseo-footer a:hover { text-decoration: underline; }
      `}</style>
    </>
  );
}
