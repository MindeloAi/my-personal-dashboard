import { IBM_Plex_Sans } from "next/font/google";

/** The dashboard's typeface (admin and login); the public site keeps Geist. */
export const dashboardFont = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
