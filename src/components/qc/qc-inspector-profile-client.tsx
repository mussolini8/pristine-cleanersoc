"use client";

import React, { useState, useEffect } from "react";
import { User, Mail, Phone, Calendar, ShieldCheck, ClipboardCheck, Award, LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface InspectorProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  color: string;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Stats {
  totalInspections: number;
  averageScore: number;
}

export function QCInspectorProfileClient() {
  const [profile, setProfile] = useState<InspectorProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ totalInspections: 0, averageScore: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Fetch inspector profile
        const { data: inspector, error } = await supabase
          .from("qc_inspectors")
          .select("*")
          .eq("email", user.email)
          .eq("status", "active")
          .maybeSingle();

        if (error || !inspector) {
          console.error("Error loading inspector profile:", error);
          setLoading(false);
          return;
        }

        setProfile(inspector as InspectorProfile);

        // Fetch stats: total inspections & average score
        const { data: inspections } = await supabase
          .from("qc_inspections")
          .select("score_percentage")
          .eq("inspector_id", inspector.id)
          .eq("status", "submitted");

        if (inspections && inspections.length > 0) {
          const total = inspections.length;
          const avg = Math.round(
            inspections.reduce((sum, item) => sum + Number(item.score_percentage || 0), 0) / total
          );
          setStats({ totalInspections: total, averageScore: avg });
        }
      } catch (err) {
        console.error("Error in profile initialization:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <User className="size-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Profile not found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          We couldn't retrieve your inspector profile. Please contact administration.
        </p>
      </div>
    );
  }

  const initial = profile.name.charAt(0).toUpperCase();
  const dateStr = new Date(profile.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 pb-24">
      {/* Profile Header Header Card */}
      <Card className="overflow-hidden border-border/60">
        <CardContent className="flex flex-col items-center p-6 text-center">
          {/* Custom Inspector Color Avatar */}
          <div
            className="flex size-20 items-center justify-center rounded-full text-white text-3xl font-bold shadow-md transition-all duration-300"
            style={{ backgroundColor: profile.color || "#10b981" }}
          >
            {initial}
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">{profile.name}</h2>
          <Badge className="mt-1.5 border-primary/20 bg-primary/10 text-primary font-semibold">
            QC Inspector
          </Badge>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center p-4 text-center">
            <ClipboardCheck className="size-5 text-primary mb-1.5" />
            <span className="text-2xl font-bold text-foreground">{stats.totalInspections}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
              QC Inspections
            </span>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center p-4 text-center">
            <Award className="size-5 text-amber-500 mb-1.5" />
            <span className="text-2xl font-bold text-foreground">
              {stats.averageScore > 0 ? `${stats.averageScore}%` : "N/A"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
              Avg Quality Score
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Details Card */}
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Personal Information
          </h3>

          <div className="flex items-center gap-3 text-sm">
            <Mail className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-muted-foreground leading-none">Email Address</p>
              <p className="text-foreground font-medium truncate mt-0.5">{profile.email || "No email set"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Phone className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground leading-none">Phone Number</p>
              <p className="text-foreground font-medium mt-0.5">{profile.phone || "No phone set"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground leading-none">Joined Team</p>
              <p className="text-foreground font-medium mt-0.5">{dateStr}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <ShieldCheck className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground leading-none">Identity Color</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="size-3.5 rounded-full border border-border shadow-sm" style={{ backgroundColor: profile.color }} />
                <span className="font-semibold text-xs font-mono tracking-wider">{profile.color.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sign Out Card */}
      <form action="/auth/sign-out" method="post" className="w-full">
        <Button variant="outline" size="lg" className="w-full border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2">
          <LogOut className="size-4" />
          Sign out from platform
        </Button>
      </form>
    </div>
  );
}
