import type { ReactNode } from "react";

import AuthForm from "@/components/AuthForm";
import "./SiteSignIn.css";

/** Public sign-in shell: logo bar, centred intro, then the page's card or status. */
export function SiteSignInPage({ kicker, title, meta, children }: {
  kicker?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="dinner-auth-shell">
      <header className="dinner-auth-nav">
        <a className="dinner-auth-logo" href="/" aria-label="Dinner Network home"><span>◒</span> dinner / network</a>
        <span className="dinner-auth-status"><i /> private beta</span>
      </header>
      <div className="dinner-auth-layout">
        <aside className="dinner-auth-art" aria-hidden="true"><div className="auth-orbit auth-orbit-a" /><div className="auth-orbit auth-orbit-b" /><div className="auth-orbit auth-orbit-c" /><div className="auth-art-word">meet<br /><em>well.</em></div><span className="auth-art-star">✦</span></aside>
        <main className="signin">
        {(kicker || title || meta) && (
          <div className="signin-intro">
            {kicker && <p className="signin-kicker">{kicker}</p>}
            {title && <h1 className="signin-title">{title}</h1>}
            {meta}
          </div>
        )}
        {children}
        </main>
      </div>
      <footer className="dinner-auth-footer"><span>good conversations, intentionally arranged</span><a href="/dinners">explore dinner network →</a></footer>
    </div>
  );
}

/** One line under the title, e.g. a member count, with the live dot. */
export function SiteSignInMeta({ children, dot = false }: { children: ReactNode; dot?: boolean }) {
  return (
    <p className="signin-meta">
      {dot && <span className="signin-meta__dot" aria-hidden="true" />}
      {children}
    </p>
  );
}

/** The bordered card with a small caps header bar that every public sign-in page uses. */
export function SiteSignInPanel({ bar, wide = false, children }: { bar: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={wide ? "signin-card signin-card--wide" : "signin-card"}>
      <h2 className="signin-card__bar"><span>{bar}</span></h2>
      <div className="signin-card__body signin-card__body--stack">{children}</div>
    </section>
  );
}

function Card({ bar, className, children }: { bar: string; className?: string; children: ReactNode }) {
  return (
    <section className="signin-card">
      <h2 className="signin-card__bar"><span>{bar}</span></h2>
      <div className={className ? `signin-card__body ${className}` : "signin-card__body"}>{children}</div>
    </section>
  );
}

/**
 * The sign-in card. Once a magic link is mailed it switches to "check your
 * email" and stays there: the link opens a new tab that finishes sign-in, so
 * this tab never reacts to the shared session arriving.
 */
export function SiteSignInCard({ bar, sentTo, sentNote, callbackURL, onAuthenticated, onMagicLinkSent, onBack, initialMode }: {
  bar: string;
  /** Address the link went to; set means the card shows "check your email". */
  sentTo: string | null;
  sentNote: string;
  callbackURL: string;
  onAuthenticated: () => void;
  onMagicLinkSent: (email: string) => void;
  onBack: () => void;
  initialMode?: 'signin' | 'signup';
}) {
  if (sentTo) {
    return (
      <Card bar={bar} className="signin-sent">
        <h3 className="signin-subtitle">Check your email</h3>
        <p className="site-p">We sent a sign-in link to <strong>{sentTo}</strong>.</p>
        <p className="site-p">{sentNote}</p>
        <button type="button" className="site-btn site-btn--secondary site-btn--block" onClick={onBack}>
          Back to sign in
        </button>
      </Card>
    );
  }
  return (
    // AuthForm keeps every behaviour (Google OAuth, magic link, password in
    // dev); SiteSignIn.css restyles its .av-* parts for the site.
    <Card bar={bar} className="auth">
      <AuthForm
        variant="inline"
        callbackURL={callbackURL}
        onAuthenticated={onAuthenticated}
        onMagicLinkSent={onMagicLinkSent}
        initialMode={initialMode}
      />
    </Card>
  );
}
