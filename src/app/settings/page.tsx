"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Bell, Check, Loader2, LockKeyhole, Moon, Settings2, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/client";

const settings = [
  { key: "qc", label: "QC reminders", description: "Show accounts that need a Last QC Check.", icon: ShieldCheck },
  { key: "reports", label: "Weekly report prompts", description: "Keep reports visible in the operating rhythm.", icon: Bell },
  { key: "secure", label: "Require staff sign-in", description: "Keep SOP pages behind authenticated access.", icon: LockKeyhole },
  { key: "dark", label: "Dark mode preference", description: "Respect the dashboard theme toggle.", icon: Moon },
];

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    qc: true,
    reports: true,
    secure: true,
    dark: false,
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);

    if (password.length < 6) {
      setPasswordMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      setPasswordMessage({ type: "error", text: error.message });
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setPasswordMessage({ type: "success", text: "Password updated in Supabase Auth." });
  }

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <style>{`
        .settings-page { display:flex; flex-direction:column; gap:18px; }
        .settings-title { font-size:1.65rem; font-weight:950; }
        .settings-sub { margin-top:4px; color:hsl(var(--muted-foreground)); font-size:.88rem; font-weight:650; }
        .settings-kicker { font-size:.72rem; font-weight:950; text-transform:uppercase; letter-spacing:.13em; color:hsl(var(--primary)); }
        .settings-grid { display:grid; grid-template-columns:minmax(0, 1.2fr) minmax(320px, .8fr); gap:14px; align-items:start; }
        .settings-card { border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--card)); padding:16px; box-shadow:0 18px 55px -48px hsl(210 40% 20%); }
        .card-title { display:flex; align-items:center; gap:8px; font-size:1rem; font-weight:950; }
        .preference-list { margin-top:14px; display:grid; gap:8px; }
        .preference-btn { display:flex; width:100%; align-items:center; justify-content:space-between; gap:12px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); padding:12px; text-align:left; cursor:pointer; transition:background .18s ease, transform .18s ease; }
        .preference-btn:hover { background:hsl(var(--accent)); transform:translateY(-1px); }
        .preference-main { display:flex; align-items:center; gap:10px; min-width:0; }
        .pref-icon { display:grid; place-items:center; width:38px; height:38px; flex-shrink:0; border-radius:8px; background:hsl(var(--primary)/.1); color:hsl(var(--primary)); }
        .pref-label { display:block; font-size:.84rem; font-weight:950; }
        .pref-desc { display:block; margin-top:2px; color:hsl(var(--muted-foreground)); font-size:.74rem; font-weight:650; }
        .check-box { display:grid; place-items:center; width:32px; height:32px; flex-shrink:0; border:1px solid hsl(var(--border)); border-radius:8px; color:hsl(var(--muted-foreground)); font-weight:950; }
        .check-box.active { border-color:hsl(var(--primary)); background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); }
        .password-form { margin-top:14px; display:grid; gap:10px; }
        .password-form label { display:grid; gap:5px; }
        .password-form span { color:hsl(var(--muted-foreground)); font-size:.68rem; font-weight:950; text-transform:uppercase; }
        .password-form input { height:40px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:0 10px; font:inherit; font-size:.85rem; font-weight:750; outline:none; }
        .password-form input:focus { border-color:hsl(var(--primary)); box-shadow:0 0 0 3px hsl(var(--primary)/.1); }
        .password-submit { display:inline-flex; align-items:center; justify-content:center; gap:7px; height:40px; border:none; border-radius:8px; background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); font-weight:950; cursor:pointer; }
        .password-submit:disabled { opacity:.72; cursor:not-allowed; }
        .settings-message { border-radius:8px; padding:9px 10px; font-size:.78rem; font-weight:850; }
        .settings-message.success { background:hsl(142 76% 36%/.12); color:hsl(142 76% 28%); }
        .settings-message.error { background:hsl(0 84% 60%/.12); color:hsl(0 84% 46%); }
        @media (max-width:900px) { .settings-grid { grid-template-columns:1fr; } }
      `}</style>

      <div className="settings-page">
        <div>
          <p className="settings-kicker">SOP Pristine Cleaners</p>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-sub">Control the operating dashboard defaults, reminders, and account security.</p>
        </div>

        <div className="settings-grid">
          <section className="settings-card">
            <div className="card-title">
              <Settings2 className="size-5 text-primary" />
              <h2>Operations Preferences</h2>
            </div>
            <div className="preference-list">
              {settings.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className="preference-btn"
                    key={item.key}
                    onClick={() => setEnabled((current) => ({ ...current, [item.key]: !current[item.key] }))}
                    type="button"
                  >
                    <span className="preference-main">
                      <span className="pref-icon"><Icon className="size-5" /></span>
                      <span>
                        <span className="pref-label">{item.label}</span>
                        <span className="pref-desc">{item.description}</span>
                      </span>
                    </span>
                    <span className={`check-box ${enabled[item.key] ? "active" : ""}`}>
                      {enabled[item.key] ? <Check className="size-4" /> : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="settings-card">
            <div className="card-title">
              <LockKeyhole className="size-5 text-primary" />
              <h2>Change Password</h2>
            </div>
            <form className="password-form" onSubmit={updatePassword}>
              <label>
                <span>New password</span>
                <input autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label>
                <span>Confirm password</span>
                <input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </label>
              {passwordMessage ? (
                <p className={`settings-message ${passwordMessage.type}`}>{passwordMessage.text}</p>
              ) : null}
              <button className="password-submit" disabled={savingPassword} type="submit">
                {savingPassword ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                Update password
              </button>
            </form>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
