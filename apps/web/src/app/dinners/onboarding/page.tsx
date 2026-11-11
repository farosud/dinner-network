import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Clipboard, MapPin, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuthContext } from "@/contexts/AuthContext";
import { dinnerProfileService, type DinnerProfile, type DinnerProfileInput } from "@/services/dinners";
import "./onboarding.css";

const promptText = `I am joining a curated dinner network. Ask me concise questions about my personality, hobbies, interests, current goals, professional background, the people I want to meet, conversation topics I enjoy or avoid, social energy, city, availability, dietary constraints, and accessibility needs.

Then return a JSON object with: short_bio, social_style, interests, conversation_topics, avoid_topics, current_goals, professional_background, people_i_want_to_meet, dinner_preferences, availability, location, dietary_constraints, accessibility_needs. Do not invent facts. Mark uncertain answers as null.`;

const steps = ["your place", "your signal", "your table", "your agent"];

function splitLines(value: string) {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

export default function DinnerOnboardingPage() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<DinnerProfile | null>(null);
  const [city, setCity] = useState("Buenos Aires");
  const [goals, setGoals] = useState("");
  const [interests, setInterests] = useState("");
  const [background, setBackground] = useState("");
  const [energy, setEnergy] = useState("warm");
  const [groupSize, setGroupSize] = useState("5");
  const [dietary, setDietary] = useState("");
  const [accessibility, setAccessibility] = useState("");
  const [rawImportedText, setRawImportedText] = useState("");
  const [days, setDays] = useState<string[]>(["tuesday", "thursday"]);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let cancelled = false;
    dinnerProfileService.get().then(({ profile: existing }) => {
      if (cancelled || !existing) return;
      setProfile(existing);
      setCity(existing.cityId ?? "Buenos Aires");
      setGoals(existing.currentGoals.join("\n"));
      setInterests(existing.interests.join(", "));
      setBackground(existing.professionalBackground.join(", "));
      setEnergy(String(existing.socialPreferences.energy ?? "warm"));
      setDays(Array.isArray(existing.availability.days) ? existing.availability.days.map(String) : ["tuesday", "thursday"]);
      setRawImportedText(existing.rawImportedText ?? "");
    }).catch(() => setError("We couldn’t load your profile. You can still start fresh."));
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate(`/login?next=${encodeURIComponent("/dinners/onboarding")}&mode=signup`, { replace: true });
  }, [isAuthenticated, isLoading, navigate]);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(city.trim()) && days.length > 0;
    if (step === 1) return Boolean(goals.trim()) && Boolean(interests.trim());
    return true;
  }, [city, days.length, goals, interests, step]);

  function toggleDay(day: string) {
    setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  }

  function copyPrompt() {
    void navigator.clipboard?.writeText(promptText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    const input: DinnerProfileInput = {
      cityId: city.trim(), shortBio: profile?.shortBio ?? null,
      professionalBackground: splitLines(background), currentGoals: splitLines(goals), interests: splitLines(interests),
      socialPreferences: { ...(profile?.socialPreferences ?? {}), energy },
      conversationPreferences: profile?.conversationPreferences ?? {}, availability: { days },
      rawImportedText: rawImportedText.trim() || null, dietaryConstraints: splitLines(dietary), accessibilityNeeds: splitLines(accessibility),
      preferredGroupSize: Number(groupSize), preferredEnergy: energy, noveltyPreference: "balanced",
      approvedFields: ["location", "currentGoals", "interests", "professionalBackground", "socialPreferences", "availability", "dietaryConstraints", "accessibilityNeeds"],
    };
    try {
      await dinnerProfileService.save(input);
      navigate("/dinners", { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We couldn’t save your profile. Try again.");
    } finally { setSaving(false); }
  }

  if (isLoading || !isAuthenticated) return null;

  return <main className="dinner-onboarding"><header className="onboarding-top"><a href="/" className="onboarding-logo"><span>◒</span> dinner / network</a><span className="onboarding-private"><i /> private beta</span></header><section className="onboarding-layout"><aside className="onboarding-aside"><p className="section-label">JOINING THE NETWORK</p><h1>Let us seat you<br /><em>well.</em></h1><p>Give us enough signal to find a table that feels natural, not manufactured. You can edit everything later.</p><div className="onboarding-steps">{steps.map((label, index) => <div key={label} className={index === step ? "current" : index < step ? "done" : ""}><span>{index < step ? "✓" : `0${index + 1}`}</span>{label}</div>)}</div></aside><section className="onboarding-card"><div className="onboarding-progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>{step === 0 && <Step title="Where should we look for your table?" detail="We currently form tables in cities where enough people are joining." ><label>your city<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Buenos Aires" autoFocus /></label><div className="location-note"><MapPin size={16} /><span>We’ll use this only to find nearby tables and restaurants.</span></div><label>which nights work for you?</label><div className="choice-grid">{[["tuesday", "Tuesday"], ["thursday", "Thursday"]].map(([value, label]) => <button type="button" key={value} className={days.includes(value) ? "choice selected" : "choice"} onClick={() => toggleDay(value)}><span>{days.includes(value) ? "✓" : ""}</span>{label}</button>)}</div></Step>}{step === 1 && <Step title="What are you carrying into the room?" detail="A few concrete details help us find people with something to talk about." ><label>what are you working toward right now?<textarea value={goals} onChange={(event) => setGoals(event.target.value)} placeholder="A company, a record, a move, a question…" autoFocus /></label><label>what are you interested in?</label><input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Design, climate, cooking, cities…" /><label>what do you do or know well? <small>optional</small></label><input value={background} onChange={(event) => setBackground(event.target.value)} placeholder="Product, music, medicine, research…" /></Step>}{step === 2 && <Step title="What makes a good table for you?" detail="These preferences help us get the mix right without making the dinner feel over-engineered." ><label>your social energy</label><div className="choice-grid three">{[["quiet", "Quiet + observant"], ["warm", "Warm + curious"], ["electric", "High energy"]].map(([value, label]) => <button type="button" key={value} className={energy === value ? "choice selected" : "choice"} onClick={() => setEnergy(value)}>{label}</button>)}</div><label>ideal group size</label><select value={groupSize} onChange={(event) => setGroupSize(event.target.value)}><option value="4">4 people</option><option value="5">5 people</option><option value="6">6 people</option></select><label>dietary requirements <small>private — never shown to the table</small></label><input value={dietary} onChange={(event) => setDietary(event.target.value)} placeholder="Vegetarian, allergies, none…" /><label>accessibility needs <small>private</small></label><input value={accessibility} onChange={(event) => setAccessibility(event.target.value)} placeholder="Anything we should plan for?" /></Step>}{step === 3 && <Step title="Bring your own agent into it." detail="Ask Claude, Codex, Hermes, or another assistant to help you answer the questions. Paste its response below, edit anything you want, then approve what we use." ><div className="agent-prompt-box"><div><Sparkles size={17} /><strong>questions for your agent</strong></div><p>Ask about your personality, hobbies, goals, background, conversation preferences, social energy, availability, dietary needs, and the people you’d enjoy meeting.</p><button type="button" onClick={copyPrompt}><Clipboard size={14} />{copied ? "copied" : "copy prompt"}</button></div><label>paste your agent’s response <small>optional — you can also finish with the answers above</small></label><textarea className="agent-response" value={rawImportedText} onChange={(event) => setRawImportedText(event.target.value)} placeholder="Paste the response here. We’ll let you review and edit it before it is used." autoFocus /></Step>}{error && <p className="onboarding-error" role="alert">{error}</p>}<div className="onboarding-actions">{step > 0 ? <button type="button" className="onboarding-back" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={16} /> back</button> : <span />}{step < steps.length - 1 ? <button type="button" className="onboarding-next" disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>continue <ArrowRight size={16} /></button> : <button type="button" className="onboarding-next" disabled={saving} onClick={() => void saveProfile()}>{saving ? "saving…" : <>save my signal <Check size={16} /></>}</button>}</div></section></section></main>;
}

function Step({ title, detail, children }: { title: string; detail: string; children: ReactNode }) { return <div className="onboarding-step"><p className="step-number">STEP</p><h2>{title}</h2><p className="step-detail">{detail}</p><div className="onboarding-fields">{children}</div></div>; }

export const Component = DinnerOnboardingPage;
