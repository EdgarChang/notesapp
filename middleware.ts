import type { NextRequest } from "next/server";
import { updateSession } from "@/app/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. Fonts are matched out
     * explicitly so the woff2 is not run through an auth check on every load.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
