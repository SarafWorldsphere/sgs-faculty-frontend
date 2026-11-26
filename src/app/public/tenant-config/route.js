import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { publicSchoolConfig } from "@saraswati/tenant-kit/resolve";

/**
 * The school's branding, for anything that needs it on the client.
 *
 * Only what is safe to put in front of a browser: the name, the logo path, the
 * colours. No connection string, no bucket, no secret — the config row is
 * written with that rule in mind and this route does not add to it.
 *
 * The school is taken from the header the proxy set, never from the query
 * string, so asking for another school's branding is not possible.
 */

export async function GET() {
  const tenantId = (await headers()).get("x-saraswati-tenant-id");
  if (!tenantId) return new NextResponse(null, { status: 404 });

  const config = await publicSchoolConfig(tenantId);
  if (!config) return new NextResponse(null, { status: 404 });

  return NextResponse.json(config);
}
