/**
 * Centralised site configuration.
 * Every component and page should import values from here
 * rather than hard-coding names, URLs, or nav items.
 */
export const siteConfig = {
  name: "GlobeScraper",
  url: "https://globescraper.com",
  description:
    "Teach English in Southeast Asia. Guides, costs, visas, and support for Vietnam, Thailand, Cambodia, and the Philippines.",
  tagline: "Teach English in Southeast Asia — guides, support, and community.",
  logoPath: "/main_logo.png",
  email: "info@globescraper.com",
  socials: {
    instagram: "https://www.instagram.com/mancavejamie/",
    tiktok: "https://www.tiktok.com/@weegienamja",
  },
  navItems: [
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: "Community", href: "/community" },
    { label: "Meetups", href: "/meetups" },
    { label: "How it works", href: "/how-it-works-to-teach-english" },
    { label: "About", href: "/about" },
  ],
} as const;

export type NavItem = (typeof siteConfig.navItems)[number];

/**
 * Shared image map — avoids scattering long CDN URLs across content files.
 * Keys are descriptive slugs; values are full URLs.
 */
const ZYRO = "https://assets.zyrosite.com/cdn-cgi/image/format=auto";
const BUCKET = "AVL7BR1MVyTjZll4";

export const images = {
  /* ---- Homepage ---- */
  heroBackground: `${ZYRO},w=1024,fit=crop/${BUCKET}/generated/generated-dJoZO9g0n9t2KL74.png`,
  cambodiaHat: "https://images.unsplash.com/photo-1565668314564-9d1bebb0a1db?auto=format&fit=crop&w=548&h=544",
  poolCouple: `${ZYRO},w=768,h=440,fit=crop/${BUCKET}/globescraper-hp-N5YPJ09My411zDSK.png`,
  classroomTeacher: `${ZYRO},w=768,h=436,fit=crop/${BUCKET}/globescraper-teacher-kfcraktWAdx87DFz.png`,

  /* ---- About ---- */
  jamieTemple: `${ZYRO},w=768,h=841,fit=crop/${BUCKET}/me-in-angkor-wat-UzFQ10WGm7C2Ig8Q.jpg`,
  jamieMotorbike: `${ZYRO},w=768,h=1664,fit=crop/${BUCKET}/me-with-a-rented-pcx-C7VT7p6ddf4curTR.jpg`,
  angkorWatPathway: `${ZYRO},w=768,h=629,fit=crop/${BUCKET}/me-with-a-rented-pcx-JnevPQUDRiK2o9yk.png`,

  /* ---- teach-english-cambodia-no-degree ---- */
  teacherClassroom: `${ZYRO},w=768,fit=crop/${BUCKET}/pexels-teacher-ray-you-get-it-582281052-31258415-AR0L4Vj826syqnO2.jpg`,
  cambodiaLandmarks: `${ZYRO},w=768,fit=crop/${BUCKET}/pexels-kelly-1179532-19063357-Yg2jkwqqg4S9V5DB.jpg`,
  teflStudent: `${ZYRO},w=768,fit=crop/${BUCKET}/pexels-ivan-samkov-4458554-YbNBMwJKgbcaP1oR.jpg`,
  localMarket: `${ZYRO},w=768,fit=crop/${BUCKET}/pexels-minan1398-1087727-m2W85GXOw4tOxlG9.jpg`,
  teacherCulture: `${ZYRO},w=768,fit=crop/${BUCKET}/pexels-tr-ng-nguy-n-thanh-2150411289-31293555-AR0L4aXNrlHEweOa.jpg`,

  /* ---- cost-of-living-cambodia-teachers ---- */
  budgetMan: "https://images.unsplash.com/photo-1475692277358-d66444784d6b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wyMjg3MDN8MHwxfHNlYXJjaHw0fHxidWRnZXR8ZW58MHx8fHwxNzM5MTk1ODc3fDA&ixlib=rb-4.0.3&q=80&w=1080",

  /* ---- cambodia-vs-disposable-income ---- */
  phnomPenhCafe: `${ZYRO},w=768,fit=crop/${BUCKET}/5-mFuICxX02xnw14XJ.jpg`,
  scooterSunset: `${ZYRO},w=768,fit=crop/${BUCKET}/1-WVUHk5JpxCLSiw08.png`,
  studioApartment: `${ZYRO},w=768,fit=crop/${BUCKET}/2-pfLoQmyVC30uSMcQ.jpg`,
  icedCoffee: `${ZYRO},w=768,fit=crop/${BUCKET}/3-VODpEkvIkvANIi1r.jpg`,
  phnomPenhSkyline: `${ZYRO},w=768,fit=crop/${BUCKET}/4-LDzcL9rlKhPqTOVd.jpg`,

  /* ---- what-to-pack ---- */
  schoolOutskirts: `${ZYRO},w=768,fit=crop/${BUCKET}/3-Awv41XXnoqSlxOZw.jpg`,
} as const;
