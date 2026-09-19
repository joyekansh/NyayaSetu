'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/* Ticker / Marquee for notices                                         */
/* ------------------------------------------------------------------ */
const NOTICES = [
  '📢 NyayaSetu is now available in Hindi — select language from the top bar.',
  '⚠️ Last date to submit BOCW welfare claims for Q2 is 30 September 2026.',
  '📋 New: Domestic Violence relief applications accepted digitally under FR-2.',
  '🔔 Legal Aid camp at Vellore District Court — 20 Oct 2026, 10 AM.',
];

function NoticeTicker() {
  return (
    <div className="gov-ticker" aria-label="Public notices">
      <span className="gov-ticker__label" aria-hidden="true">📣 Notices</span>
      <div className="gov-ticker__track" aria-live="polite">
        <div className="gov-ticker__inner">
          {[...NOTICES, ...NOTICES].map((n, i) => (
            <span key={i} className="gov-ticker__item">{n}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Utility Bar                                                          */
/* ------------------------------------------------------------------ */
function UtilityBar({
  fontSize,
  setFontSize,
  contrast,
  setContrast,
  lang,
  setLang,
}: {
  fontSize: 'sm' | 'md' | 'lg';
  setFontSize: (s: 'sm' | 'md' | 'lg') => void;
  contrast: boolean;
  setContrast: (v: boolean) => void;
  lang: 'en' | 'hi';
  setLang: (l: 'en' | 'hi') => void;
}) {
  return (
    <div className="gov-utility-bar" role="toolbar" aria-label="Accessibility tools">
      <div className="gov-utility-bar__inner">
        {/* Skip link */}
        <a href="#main-content" className="gov-skip-link">
          Skip to main content
        </a>

        {/* Font sizers */}
        <div className="flex items-center gap-1" aria-label="Font size controls">
          <span className="gov-utility-bar__label hidden sm:inline">Text size:</span>
          <button
            onClick={() => setFontSize('sm')}
            className={`gov-util-btn ${fontSize === 'sm' ? 'gov-util-btn--active' : ''}`}
            aria-label="Small text" aria-pressed={fontSize === 'sm'}
            title="Decrease font size"
          >A-</button>
          <button
            onClick={() => setFontSize('md')}
            className={`gov-util-btn ${fontSize === 'md' ? 'gov-util-btn--active' : ''}`}
            aria-label="Normal text" aria-pressed={fontSize === 'md'}
            title="Normal font size"
          >A</button>
          <button
            onClick={() => setFontSize('lg')}
            className={`gov-util-btn gov-util-btn--large ${fontSize === 'lg' ? 'gov-util-btn--active' : ''}`}
            aria-label="Large text" aria-pressed={fontSize === 'lg'}
            title="Increase font size"
          >A+</button>
        </div>

        <div className="gov-utility-bar__divider" aria-hidden="true" />

        {/* High contrast */}
        <button
          onClick={() => setContrast(!contrast)}
          className={`gov-util-btn gov-util-btn--icon ${contrast ? 'gov-util-btn--active' : ''}`}
          aria-label={contrast ? 'Disable high contrast' : 'Enable high contrast'}
          aria-pressed={contrast}
          title="Toggle high contrast"
        >
          {contrast ? '☀️' : '🌗'} <span className="hidden sm:inline">{contrast ? 'Normal' : 'High Contrast'}</span>
        </button>

        <div className="gov-utility-bar__divider" aria-hidden="true" />

        {/* Screen reader */}
        <a
          href="#"
          className="gov-util-btn gov-util-btn--icon"
          aria-label="Screen reader assistance"
          title="Screen reader help"
        >
          ♿ <span className="hidden sm:inline">Accessibility</span>
        </a>

        <div className="gov-utility-bar__divider" aria-hidden="true" />

        {/* Language switcher */}
        <div className="flex items-center gap-1" aria-label="Language selection">
          <button
            onClick={() => setLang('en')}
            className={`gov-util-btn ${lang === 'en' ? 'gov-util-btn--active' : ''}`}
            aria-label="Switch to English" aria-pressed={lang === 'en'}
          >EN</button>
          <span className="text-gov-border" aria-hidden="true">|</span>
          <button
            onClick={() => setLang('hi')}
            className={`gov-util-btn ${lang === 'hi' ? 'gov-util-btn--active' : ''}`}
            aria-label="हिन्दी में बदलें" aria-pressed={lang === 'hi'}
          >हि</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header with emblem + branding                                        */
/* ------------------------------------------------------------------ */
function GovHeader({ lang }: { lang: 'en' | 'hi' }) {
  return (
    <header className="gov-header" role="banner">
      <div className="gov-header__inner">
        {/* Left — emblem + title */}
        <div className="gov-header__brand">
          {/* Emblem placeholder — Ashoka chakra inspired */}
          <div className="gov-emblem" aria-label="National Emblem" role="img">
            <div className="gov-emblem__circle">
              <span className="gov-emblem__chakra" aria-hidden="true">⚖️</span>
            </div>
          </div>
          <div className="gov-header__title-group">
            <Link href="/upload" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gov-blue">
              <h1 className="gov-header__title-en">NyayaSetu</h1>
              <p className="gov-header__title-hi">न्यायसेतु — राष्ट्रीय विधिक सहायता पोर्टल</p>
              <p className="gov-header__subtitle">
                {lang === 'hi'
                  ? 'भारत सरकार | विधि और न्याय मंत्रालय'
                  : 'Government of India | Ministry of Law & Justice'}
              </p>
            </Link>
          </div>
        </div>

        {/* Right — Digital India branding */}
        <div className="gov-header__right" aria-label="National campaign">
          <div className="gov-di-badge">
            <div className="gov-di-badge__icon" aria-hidden="true">🇮🇳</div>
            <div>
              <p className="gov-di-badge__label">Digital India</p>
              <p className="gov-di-badge__sub">Empowering Citizens</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation bar                                                       */
/* ------------------------------------------------------------------ */
const NAV_LINKS = [
  { href: '/upload', label: 'File a Request', labelHi: 'आवेदन करें' },
  { href: '/status', label: 'Track Status', labelHi: 'स्थिति देखें' },
  { href: '/schemes', label: 'Legal Schemes', labelHi: 'कानूनी योजनाएं' },
  { href: '/faq', label: 'Help & FAQ', labelHi: 'सहायता' },
  { href: '/contact', label: 'Contact DLSA', labelHi: 'संपर्क करें' },
];

function GovNav({ lang }: { lang: 'en' | 'hi' }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="gov-nav" aria-label="Main navigation">
      <div className="gov-nav__inner">
        {/* Mobile hamburger */}
        <button
          className="gov-nav__hamburger sm:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="gov-nav-menu"
        >
          {open ? '✕' : '☰'} Menu
        </button>

        <ul
          id="gov-nav-menu"
          role="menubar"
          className={`gov-nav__list ${open ? 'gov-nav__list--open' : ''}`}
        >
          {NAV_LINKS.map((link) => (
            <li key={link.href} role="none">
              <Link
                href={link.href}
                role="menuitem"
                className="gov-nav__link"
                onClick={() => setOpen(false)}
              >
                {lang === 'hi' ? link.labelHi : link.label}
              </Link>
            </li>
          ))}
          <li role="none" className="ml-auto">
            <Link
              href="/login"
              role="menuitem"
              className="gov-nav__link gov-nav__link--operator"
              onClick={() => setOpen(false)}
            >
              {lang === 'hi' ? '⚙ संचालक लॉगिन' : '⚙ Operator Login'}
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Quick Service Tiles (homepage grid)                                  */
/* ------------------------------------------------------------------ */
const SERVICES = [
  { icon: '', title: 'File Legal Aid Request', titleHi: 'विधिक सहायता हेतु आवेदन', desc: 'Submit documents & get scheme matches', href: '/upload', color: 'gov-tile--blue' },
  { icon: '', title: 'Track Your Case', titleHi: 'केस की स्थिति जांचें', desc: 'Check real-time status of your request', href: '/status', color: 'gov-tile--green' },
  { icon: '', title: 'Know Your Rights', titleHi: 'अपने अधिकार जानें', desc: 'Browse legal schemes & eligibility', href: '/schemes', color: 'gov-tile--orange' },
  { icon: '', title: 'Find DLSA Office', titleHi: 'DLSA कार्यालय खोजें', desc: 'Locate your district legal services authority', href: '/contact', color: 'gov-tile--purple' },
  { icon: '', title: 'Legal Aid Helpline', titleHi: 'विधिक सहायता हेल्पलाइन', desc: 'Call 15100 — free legal aid helpline', href: 'tel:15100', color: 'gov-tile--red' },
  { icon: '', title: 'Download Forms', titleHi: 'फॉर्म डाउनलोड करें', desc: 'Official forms in PDF/Hindi/English', href: '#forms', color: 'gov-tile--teal' },
];

export function ServiceTiles({ lang }: { lang: 'en' | 'hi' }) {
  return (
    <section className="gov-services" aria-labelledby="services-heading">
      <div className="gov-services__header">
        <h2 id="services-heading" className="gov-section-title">
          {lang === 'hi' ? 'नागरिक सेवाएं' : 'Citizen Services'}
        </h2>
        <p className="gov-section-subtitle">
          {lang === 'hi'
            ? 'नीचे दिए गए विकल्पों में से चुनें'
            : 'Quick access to all legal aid services'}
        </p>
      </div>
      <div className="gov-services__grid" role="list">
        {SERVICES.map((svc) => (
          <Link
            key={svc.title}
            href={svc.href}
            role="listitem"
            className={`gov-tile ${svc.color}`}
            aria-label={lang === 'hi' ? svc.titleHi : svc.title}
          >
            {svc.icon && <div className="gov-tile__icon" aria-hidden="true">{svc.icon}</div>}
            <div className="gov-tile__body">
              <h3 className="gov-tile__title">
                {lang === 'hi' ? svc.titleHi : svc.title}
              </h3>
              <p className="gov-tile__desc">{svc.desc}</p>
            </div>
            <span className="gov-tile__arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                               */
/* ------------------------------------------------------------------ */
function GovFooter({ lang }: { lang: 'en' | 'hi' }) {
  return (
    <footer className="gov-footer" role="contentinfo">
      <div className="gov-footer__inner">
        <div className="gov-footer__top">
          <div>
            <p className="gov-footer__org">
              {lang === 'hi' ? 'न्यायसेतु — विधिक सहायता पोर्टल' : 'NyayaSetu — Legal Aid Portal'}
            </p>
            <p className="gov-footer__tagline">
              {lang === 'hi' ? 'भारत सरकार द्वारा संचालित' : 'Operated under Ministry of Law & Justice, Government of India'}
            </p>
          </div>
          <div className="gov-footer__badges">
            <span className="gov-footer__badge">🇮🇳 Digital India</span>
            <span className="gov-footer__badge">♿ GIGW 3.0</span>
            <span className="gov-footer__badge">🔒 DPDP Act 2023</span>
          </div>
        </div>
        <div className="gov-footer__links">
          <a href="#" className="gov-footer__link">Disclaimer</a>
          <a href="#" className="gov-footer__link">Privacy Policy</a>
          <a href="#" className="gov-footer__link">Accessibility Statement</a>
          <a href="#" className="gov-footer__link">Sitemap</a>
          <a href="#" className="gov-footer__link">Contact Us</a>
          <a href="#" className="gov-footer__link">RTI</a>
        </div>
        <p className="gov-footer__copy">
          © 2026 Government of India. Content on this website is published and managed by Ministry of Law & Justice.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Root Shell — wires everything together                               */
/* ------------------------------------------------------------------ */
export default function GovShell({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [contrast, setContrast] = useState(false);
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  // Apply font size to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('text-size-sm', 'text-size-md', 'text-size-lg');
    root.classList.add(`text-size-${fontSize}`);
  }, [fontSize]);

  // Apply contrast class
  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', contrast);
  }, [contrast]);

  return (
    <div className="gov-shell">
      <UtilityBar
        fontSize={fontSize}
        setFontSize={setFontSize}
        contrast={contrast}
        setContrast={setContrast}
        lang={lang}
        setLang={setLang}
      />
      <GovHeader lang={lang} />
      <NoticeTicker />
      <GovNav lang={lang} />

      <main id="main-content" className="gov-main" tabIndex={-1}>
        {children}
      </main>

      <GovFooter lang={lang} />
    </div>
  );
}
