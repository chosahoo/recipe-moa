import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";

  // www → non-www 리다이렉트
  if (hostname.startsWith("www.")) {
    const newUrl = new URL(request.url);
    newUrl.host = hostname.replace(/^www\./, "");
    return NextResponse.redirect(newUrl, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
