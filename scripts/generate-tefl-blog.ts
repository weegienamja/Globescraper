/**
 * Generate a TEFL course comparison blog post via Gemini API.
 * Produces an HTML file in content/posts/ with Bridge.edu affiliate links.
 *
 * Usage: npx tsx scripts/generate-tefl-blog.ts
 */

// Load .env / .env.local
import * as fs from "fs";
import * as path from "path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env"));
loadEnvFile(path.join(__dirname, "..", ".env.local"));

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-2.5-flash";

const BRIDGE_LINKS = {
  main: "https://bridge.edu/tefl?sid=101",
  bundle240: "https://bridge.edu/tefl/240-hour-master-teo-bundle?sid=101",
  master120: "https://bridge.edu/tefl/courses/professional/120-hour-master-certificate?sid=101",
  teachOnline: "https://bridge.edu/tefl/courses/specialized/teaching-english-online?sid=101",
  youngLearners: "https://bridge.edu/tefl/courses/specialized/teaching-english-to-young-learners?sid=101",
  businessEnglish: "https://bridge.edu/tefl/courses/specialized/teaching-business-english?sid=101",
  testPrep: "https://bridge.edu/tefl/courses/micro/60-hour-test-prep-triple-bundle?sid=101",
  teacherpreneur: "https://bridge.edu/tefl/teacherpreneur-academy?sid=101",
  ielts: "https://bridge.edu/tefl/courses/micro/teaching-ielts-prep?sid=101",
  grammar: "https://bridge.edu/tefl/courses/micro/teaching-english-grammar?sid=101",
  pronunciation: "https://bridge.edu/tefl/courses/micro/teaching-english-pronunciation?sid=101",
};

const SW_AFFILIATE = "https://safetywing.com/?referenceID=26254350&utm_source=26254350&utm_medium=Ambassador";
const NORDVPN_AFFILIATE = "https://nordvpn.com/?utm_medium=affiliate&utm_term&utm_content&utm_source=aff&utm_campaign=off";

const PROMPT = `You are an expert travel blogger and TEFL educator writing for GlobeScraper, a website about teaching English in Cambodia. Write a comprehensive, engaging blog post in raw HTML (inside an <article> tag) about choosing the best TEFL course for teaching in Cambodia in 2026.

CRITICAL RULES:
- Write raw HTML only (no markdown, no code fences, no backticks). Start with <article> and end with </article>.
- Use a conversational, first-person British English tone (like a mate giving advice). Similar to the other posts on the site.
- The target audience is people from the UK, South Africa, USA, Australia who want to teach English abroad without a degree.
- Use <h1> for the main title, <h2> for sections, <h3> for subsections.
- Include practical, honest advice. Not salesy — authentic and helpful.
- The post should be 1,500-2,000 words.

STRUCTURE (follow this order):
1. <h1> title: "Best TEFL Courses for Teaching English in Cambodia (2026 Guide)"
2. Opening paragraph with meta description text
3. Section: "Why Your TEFL Certificate Actually Matters in Cambodia" — explain that Cambodia doesn't require a degree, but a good TEFL opens doors to better schools and higher pay
4. Section: "What to Look for in a TEFL Course" — accreditation, hours (120+ minimum), online vs in-person, specialisations, job support
5. Section: "Bridge TEFL: My Top Recommendation" — genuinely recommend Bridge as a trusted provider. Include these specific courses with their links:
   - 120-Hour Master Certificate: ${BRIDGE_LINKS.master120}
   - 240-Hour Master TEFL/TESOL Bundle: ${BRIDGE_LINKS.bundle240}
   - Teaching English Online: ${BRIDGE_LINKS.teachOnline}
   - Teaching Young Learners: ${BRIDGE_LINKS.youngLearners}
   - Teaching Business English: ${BRIDGE_LINKS.businessEnglish}
   Present these in a helpful comparison format. Explain who each course is best for.
6. Section: "Specialised Courses Worth Considering" — mention these Bridge micro-credentials:
   - 60-Hour Test Prep Triple Bundle: ${BRIDGE_LINKS.testPrep}
   - Teaching IELTS Prep: ${BRIDGE_LINKS.ielts}
   - Teaching Grammar: ${BRIDGE_LINKS.grammar}
   - Teaching Pronunciation: ${BRIDGE_LINKS.pronunciation}
   - Teacherpreneur Academy: ${BRIDGE_LINKS.teacherpreneur}
7. Section: "How Many Hours Do You Actually Need?" — explain 120-hour minimum, why 240 is better for Cambodia
8. Section: "Online vs In-Person TEFL — Which Is Better for Cambodia?" — honest comparison
9. Section: "What About Teachers Without a Degree?" — reassure them, link to Bridge main page: ${BRIDGE_LINKS.main}

10. Include a Bridge TEFL banner using this exact HTML pattern (placed after the main Bridge recommendation section):
<div class="sw-banner">
  <a href="${BRIDGE_LINKS.main}" target="_blank" rel="noopener noreferrer" class="sw-banner__img-link">
    <img src="/Bridge-as-a-TEFL-Powerhouse-Horizontal-banner-ad.png" alt="Bridge TEFL — internationally recognised online TEFL certification courses" class="sw-banner__img" loading="lazy" />
  </a>
  <h3 class="sw-banner__title">Get TEFL Certified with Bridge</h3>
  <p class="sw-banner__text"><a href="${BRIDGE_LINKS.main}" target="_blank" rel="noopener noreferrer"><strong>Bridge</strong></a> is one of the most trusted names in TEFL certification worldwide. Their courses are internationally recognised, fully online, and self-paced.</p>
  <ul class="sw-banner__list">
    <li><a href="${BRIDGE_LINKS.master120}" target="_blank" rel="noopener noreferrer"><strong>120-Hour Master Certificate</strong></a> — ideal for getting started</li>
    <li><a href="${BRIDGE_LINKS.bundle240}" target="_blank" rel="noopener noreferrer"><strong>240-Hour Master TEFL/TESOL Bundle</strong></a> — stand out and unlock higher pay</li>
    <li><a href="${BRIDGE_LINKS.teachOnline}" target="_blank" rel="noopener noreferrer"><strong>Teaching English Online</strong></a> — add online tutoring income</li>
  </ul>
  <a href="${BRIDGE_LINKS.main}" target="_blank" rel="noopener noreferrer" class="sw-banner__cta">Explore Bridge TEFL Courses →</a>
</div>

11. Section: "Protect Yourself Before You Go" — briefly mention:
    - SafetyWing Nomad Insurance (${SW_AFFILIATE}) for travel medical cover
    - NordVPN (${NORDVPN_AFFILIATE}) for secure browsing on public Wi-Fi

Include this SafetyWing banner:
<div class="sw-banner">
  <a href="${SW_AFFILIATE}" target="_blank" rel="noopener noreferrer" class="sw-banner__img-link">
    <img src="/SafetyWing-Universe-A.jpg" alt="SafetyWing Nomad Insurance — travel medical insurance for digital nomads and teachers abroad" class="sw-banner__img" loading="lazy" />
  </a>
  <h3 class="sw-banner__title">SafetyWing Nomad Insurance</h3>
  <p class="sw-banner__text"><a href="${SW_AFFILIATE}" target="_blank" rel="noopener noreferrer"><strong>SafetyWing</strong></a> is travel medical insurance built for people living abroad. Covers hospital stays, emergency dental, and evacuations across 180+ countries. Starts from $62.72 per 4 weeks.</p>
  <a href="${SW_AFFILIATE}" target="_blank" rel="noopener noreferrer" class="sw-banner__cta">Get Covered with SafetyWing →</a>
</div>

12. Section: "Final Thoughts" — wrap up with encouragement, link back to Bridge main: ${BRIDGE_LINKS.main}
13. <hr /> then "Related Articles" section with these internal links:
    - <a href="/teach-english-cambodia-no-degree">How to Teach English in Cambodia Without a Degree</a>
    - <a href="/teaching-job-in-cambodia-2026">How to Find a Teaching Job in Cambodia</a>
    - <a href="/cost-of-living-cambodia-teachers">Cost of Living in Cambodia for English Teachers</a>

All external links must have target="_blank" rel="noopener noreferrer". All Bridge links must include ?sid=101 exactly as provided above.
Do NOT wrap the output in code fences or markdown. Output raw HTML only.`;

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Set GEMINI_API_KEY environment variable");
    process.exit(1);
  }

  console.log("Generating TEFL blog post via Gemini...\n");

  const url = `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: PROMPT }] }],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 16384,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Gemini API error ${response.status}:`, text);
    process.exit(1);
  }

  const data = await response.json();

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("No text in Gemini response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  // Strip any markdown code fences if present
  let html = text.trim();
  if (html.startsWith("```")) {
    html = html.replace(/^```html?\n?/, "").replace(/\n?```$/, "");
  }

  // Ensure it starts with <article>
  if (!html.startsWith("<article>")) {
    const artStart = html.indexOf("<article>");
    if (artStart !== -1) {
      html = html.slice(artStart);
    }
  }

  // Write to content/posts/
  const slug = "best-tefl-courses-cambodia-2026";
  const outPath = path.join(__dirname, "..", "content", "posts", `${slug}.html`);
  fs.writeFileSync(outPath, html + "\n", "utf-8");

  console.log(`✓ Blog post written to: content/posts/${slug}.html`);
  console.log(`  Length: ${html.length} characters`);
  console.log(`\nNext steps:`);
  console.log(`  1. Add entry to content/posts.json`);
  console.log(`  2. Add hero image mapping in lib/contentImages.ts`);
  console.log(`  3. Review and tweak the generated content`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
