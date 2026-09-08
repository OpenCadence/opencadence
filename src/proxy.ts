import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAllowedRequestHost } from "./lib/host-validation";

export function proxy(request: NextRequest) {
  if (!isAllowedRequestHost(request.headers.get("host"))) {
    return new NextResponse("This host is not allowed.", {
      status: 421,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
  return NextResponse.next();
}
