import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { routePermission } from "@/lib/nav";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth"];

type Ctx = { is_active: boolean; role_key: string; portal: "staff" | "student"; permissions: string[] } | null;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  const isApi = path.startsWith("/api/");

  if (!user) {
    if (isPublic) return response;
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path !== "/" ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }

  if (isPublic && !path.startsWith("/reset-password") && !path.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (isApi || path === "/403") return response;

  const { data } = await supabase.rpc("my_context");
  const ctx = data as Ctx;
  if (!ctx || !ctx.is_active) {
    // deactivated or missing profile: end the session
    await supabase.auth.signOut();
    const url = new URL("/login?error=inactive", request.url);
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  }

  // role-based landing
  if (path === "/") {
    return NextResponse.redirect(new URL(ctx.portal === "student" ? "/portal" : "/dashboard", request.url));
  }
  if (ctx.portal === "student" && !path.startsWith("/portal")) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  const rule = routePermission(path);
  if (rule) {
    const allowed = rule.systemAdminOnly
      ? ctx.role_key === "system_admin"
      : ctx.role_key === "system_admin" || ctx.permissions.includes(`${rule.module}:${rule.action}`);
    if (!allowed) {
      const r = NextResponse.rewrite(new URL("/403", request.url), { status: 403 });
      response.cookies.getAll().forEach((c) => r.cookies.set(c));
      return r;
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
