import { ArrowUpRight, CalendarDays, ChevronRight, Sparkles, Users } from "lucide-react";
import { Link } from "react-router";
import "./dinner-home.css";

const signupPath = "/login?next=/dinners&mode=signup";
const signinPath = "/login?next=/dinners";

export default function LandingPage() {
  return (
    <main className="dinner-home">
      <nav className="home-nav" aria-label="Dinner Network">
        <Link className="home-logo" to="/" aria-label="Dinner Network home"><span>◒</span> dinner / network</Link>
        <div className="home-nav-links">
          <a href="#how-it-works">how it works</a><a href="#membership">membership</a>
          <Link className="home-signin" to={signinPath}>sign in <ArrowUpRight size={14} /></Link>
        </div>
      </nav>
      <section className="home-hero">
        <div className="home-hero-copy"><p className="home-kicker"><span /> curated dinners for curious people</p><h1>Find your<br /><em>people.</em></h1><p className="home-lede">Small dinners, thoughtfully assembled. We look across the network for shared interests, complementary goals, and the kind of energy that makes a Tuesday worth leaving home for.</p><div className="home-actions"><Link className="home-primary" to={signupPath}>sign up with email <ArrowUpRight size={17} /></Link><Link className="home-secondary" to={signupPath}><span className="google-mark">G</span> sign up with Google</Link></div><p className="home-reassurance">Your first dinner is free · no credit card required</p></div>
        <div className="home-hero-art" aria-label="A dinner table forming from overlapping connections"><div className="art-orbit art-orbit-a" /><div className="art-orbit art-orbit-b" /><div className="art-orbit art-orbit-c" /><div className="art-center"><span>meet</span><span>well</span></div><span className="art-star">✦</span><div className="art-caption"><span>01</span> agents are reading the room</div></div>
      </section>
      <section className="home-strip" id="how-it-works"><div><span className="home-index">01</span><strong>Tell us your signal</strong><p>Personality, interests, current goals, and the kind of conversation you want more of.</p></div><ChevronRight className="home-strip-arrow" size={20} /><div><span className="home-index">02</span><strong>We form the table</strong><p>Our matching system finds the right mix of people as the network grows in each city.</p></div><ChevronRight className="home-strip-arrow" size={20} /><div><span className="home-index">03</span><strong>Show up hungry</strong><p>We choose the restaurant, make the reservation, and leave the evening to the people.</p></div></section>
      <section className="home-pools"><div className="home-section-heading"><p className="home-kicker">the network is taking shape</p><h2>Different people.<br /><em>Right table.</em></h2><p>There is no single type of member here. As more people join, smaller worlds emerge around what they are making, learning, and looking for next.</p></div><div className="home-pool-grid"><article className="home-pool pool-coral"><Users size={18} /><h3>builders with a<br />second act</h3><span>founders · operators · makers</span></article><article className="home-pool pool-lime"><Sparkles size={18} /><h3>music ×<br />technology</h3><span>artists · engineers · listeners</span></article><article className="home-pool pool-blue"><CalendarDays size={18} /><h3>new in<br />the city</h3><span>curious people · fresh starts</span></article></div></section>
      <section className="home-bottom" id="membership"><div><p className="home-kicker">a better kind of recurring plan</p><h2>One good dinner<br /><em>can change a week.</em></h2></div><div className="home-membership"><p>Join for $18 / month after your first dinner. We host tables on Tuesdays and Thursdays across multiple cities. You pay for your own food; we take care of the rest.</p><Link className="home-primary" to={signupPath}>join the network <ArrowUpRight size={17} /></Link></div></section>
      <footer className="home-footer"><span>© dinner / network</span><span>private beta · built for better conversations</span><Link to={signinPath}>already a member? sign in →</Link></footer>
    </main>
  );
}

export const Component = LandingPage;
