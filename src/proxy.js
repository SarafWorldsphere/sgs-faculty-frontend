import { NextResponse } from "next/server";
import { resolveTenant } from "@saraswati/tenant-kit/resolve";

/**
 * Work out which school this request is for, before any page renders.
 *
 * The address in the browser is the only thing that decides the school. A
 * request to an address we do not know is turned away here rather than being
 * served a default school, and a school that has been switched off is refused
 * without its pages ever being built.
 *
 * The header is deleted before it is set. A browser can send anything it
 * likes, including a header naming another school, and deleting it first means
 * the value that reaches the rest of the app is only ever the one resolved
 * from the host.
 */

const TENANT_HEADER = "x-saraswati-tenant-id";

export async function proxy(request) {
  const tenant = await resolveTenant(request.headers.get("host") ?? "");

  if (!tenant) return new NextResponse(null, { status: 404 });
  if (tenant.status !== "active") return new NextResponse(null, { status: 403 });

  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  headers.set(TENANT_HEADER, tenant.tenantId);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Static files and image optimisation carry no school data and run on every
  // page load, so resolving a school for them would be a database lookup per
  // asset for no benefit.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
