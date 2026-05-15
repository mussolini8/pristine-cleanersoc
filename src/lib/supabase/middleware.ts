import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { canAccessArea, getDefaultPathForRole, getRouteAccess, normalizeAppRole } from "@/lib/access-control";
import { getServerEnv } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getServerEnv();
  const access = getRouteAccess(request.nextUrl.pathname);

  if (request.nextUrl.pathname === "/residential") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const hasSupabaseSessionCookie = request.cookies.getAll().some((cookie) =>
    cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")
  );
  if (access && !hasSupabaseSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (access && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (access && user) {
    const { data: profile } = await supabase.from("profiles").select("app_role").eq("id", user.id).maybeSingle();
    const role = normalizeAppRole(profile?.app_role);
    if (!canAccessArea(role, access.area)) {
      const url = request.nextUrl.clone();
      url.pathname = getDefaultPathForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
