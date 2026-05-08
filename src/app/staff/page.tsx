"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Mail, Plus, ShieldCheck, Trash2, UserRoundCheck, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/client";

type StaffPerson = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
};

const defaultStaff: StaffPerson[] = [
  { id: "jasmine-cardenas", name: "Jasmine Cardenas", email: "cardenaskarla2603@gmail.com", role: "Residential Cleaner", status: "Active" },
  { id: "juan-romero", name: "Juan Romero", email: "juanes.romero@hotmail.com", role: "Mixed Route Cleaner", status: "Active" },
  { id: "lorena-benitez", name: "Lorena Benitez", email: "lorenabenitez382@gmail.com", role: "Residential Cleaner", status: "Active" },
  { id: "gabriel-cardenas", name: "Gabriel Cardenas", email: "g18490991@gmail.com", role: "Residential Cleaner", status: "Active" },
  { id: "rosa-calderon", name: "Rosa Calderon", email: "rosicalderon1979@gmail.com", role: "Residential Cleaner", status: "Active" },
  { id: "miriam-lopez", name: "Miriam Lopez", email: "miriam.84.mvl@gmail.com", role: "Residential Cleaner", status: "Active" },
  { id: "esperanza-yoseff", name: "Esperanza Yoseff", email: "esperanzayoseff9@gmail.com", role: "Mixed Route Cleaner", status: "Active" },
  { id: "blanca-garcia", name: "Blanca Garcia", email: "bceliag1971@gmail.com", role: "Residential Cleaner", status: "Active" },
].map((person) => ({ ...person, id: crypto.randomUUID() }) as StaffPerson);

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

function fromStaffRow(row: StaffRow): StaffPerson {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status === "Inactive" ? "Inactive" : "Active",
  };
}

function toStaffPayload(person: StaffPerson, userId: string) {
  return {
    id: person.id,
    user_id: userId,
    name: person.name,
    email: person.email,
    role: person.role,
    status: person.status,
  };
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function StaffPage() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffPerson[]>([]);
  const [draft, setDraft] = useState({ name: "", email: "", role: "Residential Cleaner", status: "Active" as StaffPerson["status"] });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStaff() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from("staff_members")
        .select("*")
        .order("name");

      if (!mounted) return;

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data && data.length > 0) {
        setStaff((data as StaffRow[]).map(fromStaffRow));
        return;
      }

      const { data: created, error: seedError } = await supabase
        .from("staff_members")
        .insert(defaultStaff.map((person) => toStaffPayload(person, user.id)))
        .select("*");

      if (!mounted) return;

      if (seedError) {
        setErrorMessage(seedError.message);
        return;
      }

      setStaff(((created ?? []) as StaffRow[]).map(fromStaffRow));
    }

    loadStaff();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const activeCount = useMemo(() => staff.filter((person) => person.status === "Active").length, [staff]);
  const mixedCount = useMemo(() => staff.filter((person) => person.role.includes("Mixed")).length, [staff]);

  async function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.email.trim() || !userId) return;

    const person = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      email: draft.email.trim(),
      role: draft.role,
      status: draft.status,
    };
    const previous = staff;
    setStaff((prev) => [person, ...prev]);
    setDraft({ name: "", email: "", role: "Residential Cleaner", status: "Active" });

    const { error } = await supabase.from("staff_members").insert(toStaffPayload(person, userId));
    if (error) {
      setErrorMessage(error.message);
      setStaff(previous);
    }
  }

  async function removePerson(id: string) {
    const previous = staff;
    setStaff((prev) => prev.filter((person) => person.id !== id));
    const { error } = await supabase.from("staff_members").delete().eq("id", id);
    if (error) {
      setErrorMessage(error.message);
      setStaff(previous);
    }
  }

  return (
    <DashboardShell userEmail="pristinecleanersoc@gmail.com">
      <style>{`
        .staff-page { display:flex; flex-direction:column; gap:18px; }
        .staff-hero { border:1px solid hsl(var(--border)); border-radius:8px; padding:18px; background:
          linear-gradient(135deg,hsl(var(--primary)/.11),hsl(199 89% 48%/.07),hsl(42 95% 55%/.1)); box-shadow:0 18px 50px -42px hsl(210 40% 20%); }
        .hero-row { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .hero-kicker { display:flex; align-items:center; gap:7px; font-size:.72rem; font-weight:950; text-transform:uppercase; letter-spacing:.12em; color:hsl(var(--primary)); }
        .hero-title { margin-top:8px; font-size:1.65rem; font-weight:950; }
        .hero-sub { margin-top:4px; max-width:680px; color:hsl(var(--muted-foreground)); font-size:.88rem; font-weight:650; }
        .staff-form { display:grid; grid-template-columns:1.1fr 1.2fr .9fr .7fr auto; gap:8px; align-items:end; }
        .staff-form label { display:flex; flex-direction:column; gap:5px; min-width:0; }
        .staff-form span { font-size:.65rem; font-weight:950; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
        .staff-form input, .staff-form select { height:38px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--foreground)); padding:0 10px; font:inherit; font-size:.82rem; font-weight:750; outline:none; }
        .staff-form input:focus, .staff-form select:focus { border-color:hsl(var(--primary)); box-shadow:0 0 0 3px hsl(var(--primary)/.1); }
        .add-person-btn { display:inline-flex; align-items:center; gap:7px; height:38px; border:none; border-radius:8px; padding:0 13px; background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); font-weight:950; cursor:pointer; white-space:nowrap; }
        .stat-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
        .stat-card { border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--card)); padding:14px; box-shadow:0 16px 42px -42px hsl(210 40% 20%); }
        .stat-card svg { color:hsl(var(--primary)); }
        .stat-label { margin-top:12px; font-size:.68rem; font-weight:950; text-transform:uppercase; letter-spacing:.1em; color:hsl(var(--muted-foreground)); }
        .stat-value { margin-top:3px; font-size:1.8rem; font-weight:950; }
        .directory { border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--card)); overflow:hidden; box-shadow:0 18px 55px -48px hsl(210 40% 20%); }
        .directory-head { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid hsl(var(--border)); }
        .directory-title { font-size:.98rem; font-weight:950; }
        .directory-count { font-size:.72rem; font-weight:900; color:hsl(var(--muted-foreground)); }
        .staff-list { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); }
        .person-card { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 14px; border-bottom:1px solid hsl(var(--border)); }
        .person-card:nth-child(odd) { border-right:1px solid hsl(var(--border)); }
        .person-main { display:flex; align-items:center; gap:12px; min-width:0; }
        .avatar { display:grid; place-items:center; width:42px; height:42px; flex-shrink:0; border-radius:8px; background:hsl(var(--primary)/.1); color:hsl(var(--primary)); font-size:.82rem; font-weight:950; }
        .person-name { font-size:.9rem; font-weight:950; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .person-email { margin-top:4px; display:flex; min-width:0; align-items:center; gap:5px; color:hsl(var(--muted-foreground)); font-size:.76rem; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .person-side { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .person-status { text-align:right; }
        .person-status strong { display:block; color:hsl(var(--primary)); font-size:.74rem; }
        .person-status span { display:block; margin-top:3px; color:hsl(var(--muted-foreground)); font-size:.72rem; font-weight:800; }
        .delete-btn { display:grid; place-items:center; width:32px; height:32px; border:1px solid hsl(var(--border)); border-radius:8px; background:hsl(var(--background)); color:hsl(var(--muted-foreground)); cursor:pointer; }
        .delete-btn:hover { color:hsl(0 84% 50%); border-color:hsl(0 84% 60%/.35); background:hsl(0 84% 60%/.08); }
        @media (max-width:980px) { .staff-form { grid-template-columns:1fr 1fr; } .add-person-btn { justify-content:center; } }
        @media (max-width:760px) { .stat-grid, .staff-list { grid-template-columns:1fr; } .person-card:nth-child(odd) { border-right:none; } .staff-form { grid-template-columns:1fr; } }
      `}</style>

      <div className="staff-page">
        <section className="staff-hero">
          <div className="hero-row">
            <div>
              <p className="hero-kicker"><Users className="size-4" /> SOP Pristine Cleaners</p>
              <h1 className="hero-title">Staff</h1>
              <p className="hero-sub">Cleaner roster for payroll, QC follow-up, and operations assignments.</p>
            </div>
          </div>
        </section>

        <form className="staff-form" onSubmit={addPerson}>
          <label>
            <span>Name</span>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Carlos Lopez" />
          </label>
          <label>
            <span>Email</span>
            <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="name@email.com" type="email" />
          </label>
          <label>
            <span>Role</span>
            <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
              <option>Residential Cleaner</option>
              <option>Mixed Route Cleaner</option>
              <option>Commercial Cleaner</option>
              <option>Supervisor</option>
              <option>Admin</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as StaffPerson["status"] })}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <button className="add-person-btn" type="submit"><Plus size={15} /> Add</button>
        </form>
        {errorMessage ? (
          <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">{errorMessage}</p>
        ) : null}

        <div className="stat-grid">
          <div className="stat-card">
            <Users className="size-5" />
            <p className="stat-label">Total Staff</p>
            <p className="stat-value">{staff.length}</p>
          </div>
          <div className="stat-card">
            <UserRoundCheck className="size-5" />
            <p className="stat-label">Active</p>
            <p className="stat-value">{activeCount}</p>
          </div>
          <div className="stat-card">
            <ShieldCheck className="size-5" />
            <p className="stat-label">Mixed Routes</p>
            <p className="stat-value">{mixedCount}</p>
          </div>
        </div>

        <section className="directory">
          <div className="directory-head">
            <h2 className="directory-title">Cleaner Directory</h2>
            <span className="directory-count">{staff.length} people</span>
          </div>
          <div className="staff-list">
            {staff.map((person) => (
              <article className="person-card" key={person.id}>
                <div className="person-main">
                  <div className="avatar">{initials(person.name)}</div>
                  <div className="min-w-0">
                    <h3 className="person-name">{person.name}</h3>
                    <p className="person-email"><Mail className="size-3 shrink-0" /> {person.email}</p>
                  </div>
                </div>
                <div className="person-side">
                  <div className="person-status">
                    <strong>{person.status}</strong>
                    <span>{person.role}</span>
                  </div>
                  <button className="delete-btn" type="button" aria-label={`Delete ${person.name}`} onClick={() => removePerson(person.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
