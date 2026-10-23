import { Inter, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { TenantProvider, loadSchoolConfig, themeName } from "@saraswati/tenant-kit";
import "@saraswati/tenant-kit/themes.css";
import "./globals.css";

const inter = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const body = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Named for the product rather than a school: one deployment now serves every
// school, so the title cannot carry a school's name. The school's own name is
// shown inside the page, from its config.
export const metadata = {
  title: "Faculty Portal",
  description: "Lesson plans, notes, assessments and student insights for teachers.",
  keywords: ["AI in Schools", "EdTech", "Teacher Portal"],
};

/**
 * The school is loaded once here, on the server, and handed to the whole tree.
 *
 * Every component below reads it with useSchool() instead of importing a logo
 * or a name of its own, so a new school needs a row of config rather than a
 * change in here. `data-theme` lets the stylesheet pick that school's palette
 * before anything paints, which avoids one school's colours flashing up on
 * another school's page.
 */
export default async function RootLayout({ children }) {
  const host = (await headers()).get("host") ?? "";
  const config = await loadSchoolConfig(host);

  return (
    <html
      lang="en"
      data-theme={themeName(config.theme)}
      className={`${inter.variable} ${body.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <TenantProvider config={config}>{children}</TenantProvider>
      </body>
    </html>
  );
}
