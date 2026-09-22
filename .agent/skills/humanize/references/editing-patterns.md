# Editing patterns


### CRITICAL: Structural Patterns

#### 1. Em Dashes: ZERO TOLERANCE

Avoid em dashes in authored prose, headings, alt text, and editable comments. Preserve verbatim quotations, executable code, literal data, and meaningful syntax.

| AI | Human |
|----|-------|
| "The agent still reasons—it chooses which tools to call" | "The agent still reasons. It chooses which tools to call." |
| "Steering gives you localized control—without global rigidity" | "Steering gives you localized control without global rigidity." |

Fix: Period, comma, colon, or "and".

#### 2. Staccato sequences

3+ short sentences in a row for dramatic effect. "Simple. Clean. Effective."

Fix: Combine into one sentence with natural rhythm. Short sentences work only when surrounded by longer ones.

#### 3. Theatrical writing

Dramatic reveals ("And then it doesn't."), teaser phrases ("Now watch what happens."), ominous foreshadowing ("This is where things get interesting."), cliffhanger transitions, narrator voice ("Let's see how this plays out.").

Test: Would you say this to a coworker explaining a technical problem? If it sounds like a YouTube intro, rewrite it.

#### 4. Pseudo-profound reframing

All variants of staged-reveal constructions:
- "It's not X, it's Y" -> just state Y
- "The question isn't X, it's Y" -> just state Y
- "X doesn't just do A. It does B." -> just state B
- "Not only X, but also Y" -> state both plainly, or just Y
- "Not a mirror but a portal" (poetic not-X-but-Y) -> state what it is
- "No X, no Y, just Z" -> state Z

These shape-shift: banning one phrasing makes the same staged-contrast urge reappear in new syntax. Scan for the SHAPE (setup half that exists only to be knocked down), not just the strings.

Fix: Delete the setup half. State the point directly.

#### 5. Structure-narrating & reader-mind-reading

**5a. Announcing what you're about to say:** "Here's the thing:", "Here's the shift.", "Let me break this down." Delete the announcement, start with the content.

**5b. Telling readers what they think:** "Most people underestimate...", "What people don't realize is..." Delete the frame, make the point.

**5c. Fragment-as-sentence listing:** "Guardrails, grounding, RAG, evaluation frameworks." as a standalone sentence. Weave into a real sentence.

#### 6. Synonym cycling

AI rotates synonyms to avoid repetition: "the agent... the autonomous system... the AI assistant..." Pick the clearest term and repeat it. Clarity beats variety.

#### 7. Rule of three

AI forces ideas into groups of three: "innovation, inspiration, and insights." Use the natural number of items. Two? Say two. Five? Say five.

#### 8. False ranges

"From solo developers to cross-functional teams," "from prototyping to production." If the range is just "small to big" dressed up, simplify.

#### 9. Copula avoidance

"Serves as," "functions as," "stands as," "features," "boasts," "represents a," "refers to," "offers," "maintains," "sits at" -> use "is" or "has."

### Formatting Artifacts

| Pattern | Fix |
|---------|-----|
| Boldface overuse (mechanical bolding of key terms) | Remove bold unless genuine emphasis |
| Emoji as structure (rocket Launch Phase:) | Delete all emoji from prose/headings |
| Title Case Headings | Convert to sentence case |
| Curly quotes | Replace with straight quotes |
| Hyphenated compound pileup (3+ in a paragraph) | Unpack into plain language |

### Phrases to Flag

#### AI vocabulary density (added 2026-08 from Wikipedia:Signs of AI writing + excess-vocabulary research)
Individually innocent words that are statistically overrepresented in LLM output: "delve," "tapestry," "testament," "interplay," "intricate/intricacies," "meticulous(ly)," "garner," "bolster(ed)," "align with," "fostering," "showcasing," "emphasizing," "enhance," "deep dive," "key" (as adjective), "valuable insights," "pivotal," "crucial," "landscape" (abstract), "vibrant," sentence-initial "Additionally,"/"Moreover,"/"Furthermore,".

The density principle: one of these words is coincidence; three or more co-occurring in a passage is the signature. Don't mechanically ban single uses; hunt clusters and rewrite the passage, not just the word.

#### Vague connectors
"associated with," "in connection with," "linked to," "tied to" when the actual relationship is known. State it: "used for," "caused by," "built on," "owned by."

#### Puffery & significance inflation
"stands as," "serves as," "is a testament to," "vital/significant/crucial/pivotal role," "underscores its importance," "indelible mark," "enduring legacy," "evolving landscape," "setting the stage for," "represents a shift"

#### Promotional language
"boasts a," "vibrant," "profound," "showcasing," "exemplifies," "groundbreaking," "renowned," "seamlessly," "robust" (generic praise), "elegant" (generic praise), "cutting-edge," "state-of-the-art," "world-class," "innovative" (unsupported)

#### Superficial -ing analysis
"-ing" phrases tacked onto sentence ends: "highlighting...," "underscoring...," "emphasizing...," "ensuring...," "reflecting..."

Fix: End the sentence earlier or make it a separate sentence with substance.

#### Weasel words
"Experts argue," "Industry reports suggest," "Studies have shown" (no citation), "It is widely believed"

#### Sycophantic tone
"Great question!", "That's an excellent point!", "You're absolutely right!"

Fix: Delete entirely.

#### Hedging phrases
"It's important to note that," "It's worth mentioning that," "Interestingly," "Notably," "Certainly," "Indeed," "Of course," "Needless to say"

Fix: Remove the hedge. Just state the thing.

#### Internal jargon
"undifferentiated heavy lifting," "dive deep," "working backwards," "Day 1 mentality," "mechanisms," "bar raiser"

Fix: Translate to plain language.

#### Opening/closing cliches
Openings: "Let's dive in," "Without further ado," "In this blog post, we will," "Let's explore"
Closings: "In conclusion," "To summarize," "To wrap up," "All in all," "At the end of the day"
Formula endings: the "challenges and future outlook" template ("Despite these challenges... looking ahead..."), ending on vague optimism. End on the last concrete point instead.

#### Hedging then puffing
Acknowledging something is minor, then inflating importance anyway. "Though it saw only limited application, it contributes to the broader history..." -> "It saw limited application." (stop there)

### Sentence Rhythm

Real writing varies naturally:
- Long sentences with multiple clauses that build on each other
- Short ones
- Most are medium, carrying prose forward without calling attention to themselves

AI produces either uniform medium sentences or dramatic short bursts. If you notice a run of same-length sentences, vary them.

### Paragraph Rhythm & Resolution Addiction

Two global tells that survive sentence-level cleanup:

- **Uniform paragraph weight.** AI paragraphs come out 3-4 sentences each, every one carrying equal load. Human writing has a two-line paragraph next to an eight-line one. If every paragraph is the same size, merge or split some.
- **Resolution addiction.** AI ends every paragraph with a tidy summarizing bow ("...and that's what makes it powerful."). Humans let some paragraphs end on the fact itself. Delete bows that restate what the paragraph already showed; keep at most one or two intentional punchlines per piece.


## Additional patterns from the companion humanizer

- Artificial enthusiasm: replace unsupported praise with a concrete, supported
  result. Never invent a metric to make a sentence more specific.
- Structure narration also appears as "Here's the deal", "Here's the catch",
  "Here's how it works", and "It gets better". Start with the substance.
- Preserve meaningful ranges, necessary qualifications, technical uses of words,
  and intentional rhetorical choices. These checks guide editing; they are not
  a test of whether a person or an AI authored the text.
