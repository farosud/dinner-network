import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, ChevronRight, CircleHelp, LogOut, MapPin, Sparkles, Users, X } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { dinnerProfileService, type DinnerProfile } from "@/services/dinners";
import { useNavigate } from "react-router";
import "./dinners.css";

type Panel = "overview" | "profile" | "dinners";

const pools = [
  { name: "builders with a second act", count: 18, color: "coral", detail: "founders, operators, and makers exploring what comes next" },
  { name: "the music x technology table", count: 11, color: "lime", detail: "musicians and builders trading notes on creative tools" },
  { name: "new in the city", count: 24, color: "blue", detail: "people looking for a warmer way to meet their place" },
];

const upcoming = [
  { date: "TUE 18", day: "Tuesday", city: "Buenos Aires", area: "Palermo Viejo", place: "A small table near the kitchen", seats: "4 / 6 seats", tag: "builders with a second act", accent: "coral" },
  { date: "THU 20", day: "Thursday", city: "Mendoza", area: "Godoy Cruz", place: "A long table, good acoustics", seats: "3 / 6 seats", tag: "new in the city", accent: "blue" },
];

const promptText = `You are helping me prepare a private profile for a curated dinner-matching service.

Ask me concise questions about my personality, hobbies, interests, current goals, professional background, the people I want to meet, conversation topics I enjoy or avoid, social energy, city, availability, dietary constraints, and accessibility needs.

Then return a JSON object with: short_bio, social_style, interests, conversation_topics, avoid_topics, current_goals, professional_background, people_i_want_to_meet, dinner_preferences, availability, location, dietary_constraints, accessibility_needs. Do not invent facts. Mark uncertain answers as null.`;

export default function DinnersPage() {
  const { isAuthenticated, user, signOut } = useAuthContext();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>("overview");
  const [showPrompt, setShowPrompt] = useState(false);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<DinnerProfile | null>(null);
  const [location, setLocation] = useState("Buenos Aires");
  const [goals, setGoals] = useState("");
  const [energy, setEnergy] = useState("warm");

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    dinnerProfileService.get()
      .then((result) => {
        if (cancelled || !result.profile) return;
        setProfile(result.profile);
        setJoined(true);
        setLocation(String(result.profile.socialPreferences.cityName ?? result.profile.cityId ?? "Buenos Aires"));
        setGoals(result.profile.currentGoals.join("\n"));
        setEnergy(String(result.profile.socialPreferences.energy ?? "warm"));
      })
      .catch(() => { /* The fixture experience remains usable while the API is unavailable. */ });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const profileProgress = useMemo(() => joined ? 82 : 36, [joined]);

  function copyPrompt() {
    void navigator.clipboard?.writeText(promptText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="dinner-app">
      <aside className="dinner-sidebar">
        <div className="dinner-mark"><span>◒</span> dinner / network</div>
        <div className="dinner-city"><MapPin size={14} /> Buenos Aires <span className="city-chevron">⌄</span></div>
        <nav className="dinner-nav" aria-label="Dinner network">
          <button className={panel === "overview" ? "active" : ""} onClick={() => setPanel("overview")}><span>01</span> My table</button>
          <button className={panel === "dinners" ? "active" : ""} onClick={() => setPanel("dinners")}><span>02</span> Upcoming dinners</button>
          <button className={panel === "profile" ? "active" : ""} onClick={() => setPanel("profile")}><span>03</span> My profile</button>
        </nav>
        <div className="sidebar-note">
          <div className="note-dot" />
          <p>agents are reading the room. your next good conversation may already be forming.</p>
        </div>
        <div className="sidebar-bottom"><span>v0.1 / private beta</span><button><CircleHelp size={14} /> how it works</button></div>
      </aside>

      <section className="dinner-content">
        <header className="dinner-header">
          <div>
            <p className="eyebrow">THURSDAY, 13 NOVEMBER 2026</p>
            <h1>{panel === "overview" ? <>find your<br /><em>people.</em></> : panel === "dinners" ? <>the next<br /><em>tables.</em></> : <>make your<br /><em>signal.</em></>}</h1>
          </div>
          <div className="header-actions"><span className="status-pill"><i /> agents active</span>{isAuthenticated ? <><button className="logout-button" onClick={() => void signOut()}><LogOut size={13} /> log out</button><button className="avatar" onClick={() => setPanel("profile")} aria-label="Open dinner profile">{(user?.name ?? user?.email ?? "EV").slice(0, 2).toUpperCase()}</button></> : <button className="join-button" onClick={() => navigate("/login?next=/dinners")}>join / sign in <ArrowUpRight size={15} /></button>}</div>
        </header>

        {panel === "overview" && (
          <>
            <section className="hero-card">
              <div className="hero-copy"><span className="section-label">01 / YOUR NEXT INVITATION</span><h2>A table for people who are <u>going somewhere.</u></h2><p>We look across the network for shared interests, complementary goals, and the kind of energy that makes a Tuesday feel worth leaving home for.</p><button className="dark-button" onClick={() => setPanel("dinners")}>see the next tables <ArrowUpRight size={17} /></button></div>
              <div className="hero-drawing" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><span className="orbit-word">meet<br />well</span><span className="orbit-star">✦</span></div>
            </section>
            <section className="section-block"><div className="section-heading"><div><span className="section-label">02 / THE NETWORK IS TAKING SHAPE</span><h3>small worlds, still forming</h3></div><span className="muted-label">{pools.length} live pools</span></div><div className="pool-grid">{pools.map((pool) => <article className={`pool-card ${pool.color}`} key={pool.name}><div className="pool-top"><span className="pool-icon"><Users size={16} /></span><span>{pool.count} people</span></div><h4>{pool.name}</h4><p>{pool.detail}</p><button onClick={() => setPanel("dinners")}>explore pool <ChevronRight size={14} /></button></article>)}</div></section>
            <section className="section-block invitation-block"><div className="section-heading"><div><span className="section-label">03 / A LITTLE MORE OF YOU</span><h3>give your agent better material</h3></div><span className="progress-label">{profileProgress}% complete</span></div><div className="profile-progress"><span style={{ width: `${profileProgress}%` }} /></div><div className="profile-row"><div><strong>{joined ? "your profile is in the mix" : "your profile is just getting started"}</strong><p>{joined ? "Your interests and goals are ready to be considered for new tables." : "Answer a few questions here, or ask your own agent to help you think."}</p></div><button className="outline-button" onClick={() => setPanel("profile")}>{joined ? "edit profile" : "complete profile"} <ArrowUpRight size={15} /></button></div></section>
          </>
        )}

        {panel === "dinners" && <section className="dinner-list"><div className="list-intro"><p>Every dinner is selected around a real table, a real date, and enough room for the conversation to breathe.</p><div className="date-filter"><button className="selected">all cities</button><button>this week</button><button>next week</button></div></div>{upcoming.map((dinner) => <article className="dinner-event" key={dinner.date}><div className={`date-tile ${dinner.accent}`}><strong>{dinner.date.split(" ")[1]}</strong><span>{dinner.date.split(" ")[0]}</span></div><div className="event-main"><div className="event-meta"><span>{dinner.day}</span><span>·</span><span>{dinner.city}</span></div><h2>{dinner.place}</h2><p><MapPin size={14} /> {dinner.area} <span className="meta-divider">/</span> <Users size={14} /> {dinner.seats}</p><span className={`event-tag ${dinner.accent}`}>{dinner.tag}</span></div><button className="event-arrow" onClick={() => setJoined(true)} aria-label={`Join ${dinner.day} dinner`}><ArrowUpRight size={20} /></button></article>)}</section>}

        {panel === "profile" && <section className="profile-panel"><div className="profile-intro"><span className="section-label">YOUR PRIVATE SIGNAL</span><h2>Tell us enough to<br /><em>seat you well.</em></h2><p>Nothing becomes visible to another participant until you approve the dinner. We use this to help your agent find the right kind of room.</p><button className="dark-button" onClick={() => setShowPrompt(true)}><Sparkles size={16} /> get questions for your agent</button></div><div className="profile-fields"><label>Where are you based?<input value={location} onChange={(event) => setLocation(event.target.value)} /></label><label>What are you working toward right now?<textarea placeholder="A company, a record, a move, a new question…" value={goals} onChange={(event) => setGoals(event.target.value)} /></label><div className="field-row"><label>Social energy<select value={energy} onChange={(event) => setEnergy(event.target.value)}><option value="warm">warm, curious</option><option value="quiet">quiet, observant</option><option value="electric">high energy</option></select></label><label>Best dinner nights<select defaultValue="both"><option value="both">Tuesday + Thursday</option><option value="tuesday">Tuesday</option><option value="thursday">Thursday</option></select></label></div><button className="save-button" onClick={() => { const input = { cityId: location || null, shortBio: profile?.shortBio ?? null, professionalBackground: profile?.professionalBackground ?? [], currentGoals: goals.split("\n").map((value) => value.trim()).filter(Boolean), interests: profile?.interests ?? [], socialPreferences: { ...(profile?.socialPreferences ?? {}), energy }, conversationPreferences: profile?.conversationPreferences ?? {}, availability: { days: ["tuesday", "thursday"] }, rawImportedText: profile?.rawImportedText ?? null, dietaryConstraints: [], accessibilityNeeds: [], preferredGroupSize: 5, preferredEnergy: energy, noveltyPreference: "balanced", approvedFields: ["location", "currentGoals", "socialPreferences"] }; void (isAuthenticated ? dinnerProfileService.save(input).then((result) => { setProfile(result.profile); setJoined(true); }) : Promise.resolve()).catch(() => { /* Keep local edits visible if the API is offline. */ }); setJoined(true); }}><Check size={16} /> save my signal</button></div></section>}
      </section>

      {showPrompt && <div className="prompt-backdrop" role="presentation" onMouseDown={() => setShowPrompt(false)}><div className="prompt-modal" role="dialog" aria-modal="true" aria-labelledby="prompt-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowPrompt(false)} aria-label="Close"><X size={18} /></button><span className="section-label">COPY INTO CLAUDE / CODEX / HERMES</span><h2 id="prompt-title">let your agent<br /><em>ask better questions.</em></h2><p>Paste this into the assistant you already use. Bring the answer back here and you can edit every field before sharing it.</p><pre>{promptText}</pre><button className="dark-button full-button" onClick={copyPrompt}>{copied ? <><Check size={16} /> copied to clipboard</> : <>copy prompt <ArrowUpRight size={16} /></>}</button></div></div>}
    </main>
  );
}

export const Component = DinnersPage;
