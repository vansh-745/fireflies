"""Demo workspace: a fictional company ("Orbit Labs") and eight meetings.

Transcripts use the same ``Speaker: text`` format that users can upload, so the
seed goes through the real parser. Chapters and action items point at the
transcript line that contains the ``at`` snippet.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models import ParticipantRole, Platform

H, A = ParticipantRole.HOST, ParticipantRole.ATTENDEE

PEOPLE = {
    "Alex Rivera": "alex.rivera@orbit.example",
    "Priya Sharma": "priya.sharma@orbit.example",
    "Marcus Chen": "marcus.chen@orbit.example",
    "Jordan Blake": "jordan.blake@orbit.example",
    "Sofia Martinez": "sofia.martinez@orbit.example",
    "Daniel Okafor": "daniel.okafor@orbit.example",
    "Emily Watson": "emily.watson@orbit.example",
    "Liam O'Connor": "liam.oconnor@orbit.example",
    "Rachel Kim": "rachel.kim@acme.example",
    "Tom Becker": "tom.becker@acme.example",
    "Hannah Lee": "hannah.lee@mail.example",
    "David Park": "david.park@globex.example",
    "Maria Gonzalez": "maria.gonzalez@globex.example",
}


@dataclass
class SeedChapter:
    title: str
    at: str
    bullets: list[str]


@dataclass
class SeedAction:
    text: str
    assignee: str | None
    at: str
    done: bool = False
    due_in_days: int | None = None  # relative to the meeting date


@dataclass
class SeedMeeting:
    title: str
    days_ago: int
    hour: int  # UTC
    minute: int
    platform: Platform
    participants: list[tuple[str, ParticipantRole]]
    tags: list[str]
    transcript: str
    gist: str
    overview: list[str]
    keywords: list[str]
    chapters: list[SeedChapter]
    actions: list[SeedAction]
    comments: list[tuple[str, str]] = field(default_factory=list)  # (at, body)
    soundbites: list[tuple[str, str, str]] = field(default_factory=list)  # (title, from_at, to_at)


MEETINGS: list[SeedMeeting] = [
    # ── 1 ────────────────────────────────────────────────────────────────────
    SeedMeeting(
        title="Weekly Engineering Standup",
        days_ago=0,
        hour=4,
        minute=30,
        platform=Platform.GOOGLE_MEET,
        participants=[("Priya Sharma", H), ("Daniel Okafor", A), ("Emily Watson", A), ("Marcus Chen", A)],
        tags=["Engineering", "Standup"],
        transcript="""
Priya Sharma: Morning all. Let's keep this quick, we've got a lot going on this week. Daniel, want to kick us off?
Daniel Okafor: Sure. Yesterday I got the Salesforce developer sandbox set up and started the bulk API spike. The good news is authentication works end to end. Today I'm testing batch sizes to see how many records we can push per call.
Priya Sharma: Nice. Any blockers?
Daniel Okafor: One. Salesforce requires a connected app review for managed packages, and that can take up to 6 weeks. We should submit early even if the code isn't final.
Priya Sharma: Good catch. That's a real risk to the November 20th beta. Can you start the connected app submission today?
Daniel Okafor: Yes, I'll draft the submission this afternoon and send it to you for review.
Priya Sharma: Thanks. Emily?
Emily Watson: Yesterday I finished the dark mode fixes for the dashboard and merged the date picker refactor. Today I'm starting on the workflow canvas, setting up the new drag and drop library.
Marcus Chen: Which library did you end up picking?
Emily Watson: We went with dnd kit. It handled keyboard accessibility much better than the alternatives, and the bundle is about 40 percent smaller.
Marcus Chen: Great, accessibility was one of my biggest concerns. I'll have the final canvas specs to you by Wednesday.
Emily Watson: Perfect. Until then I'll build the basic canvas grid and zoom controls, since those are pretty stable in the prototype.
Priya Sharma: Any blockers, Emily?
Emily Watson: Not a blocker, but the staging environment has been really slow. Page loads are taking 8 to 10 seconds. It's slowing down QA.
Daniel Okafor: That's probably the database. Staging is still on the smallest instance and we doubled the seed data last week.
Priya Sharma: Daniel, could you bump the staging database to the next instance size? It's about $150 a month more, which is fine.
Daniel Okafor: Sure, I'll do that right after standup.
Priya Sharma: Marcus, anything from design?
Marcus Chen: Just a heads up that we're running two more usability sessions on Thursday for the step library. If anyone from engineering wants to observe, let me know.
Emily Watson: I'd love to join one of those.
Marcus Chen: Great, I'll send you the invite.
Priya Sharma: From my side, I updated the Q4 capacity plan in Linear. Please check your assignments and flag anything that looks wrong by Friday.
Daniel Okafor: Will do.
Priya Sharma: Also, reminder that the incident review for last Tuesday's outage is on Thursday at 3pm. The root cause was the expired TLS certificate on the webhooks service.
Daniel Okafor: I'll add certificate expiry monitoring before the review, so we can say it's fixed.
Priya Sharma: Perfect. That's it, thanks everyone. Have a good one.
""",
        gist="Salesforce sandbox is working, the connected-app review is flagged as a risk, canvas work has started on dnd kit, and staging gets a bigger database.",
        overview=[
            "Daniel has Salesforce authentication working end to end. The connected app review can take up to 6 weeks, which puts the November 20 beta at risk, so the submission starts today.",
            "Emily merged the dark mode fixes and the date picker refactor. She is starting the workflow canvas on dnd kit, picked for keyboard accessibility and a ~40% smaller bundle.",
            "Staging page loads take 8–10 seconds; the staging database moves up one instance size (~$150/month).",
            "Two step-library usability sessions run on Thursday, and the incident review for the TLS certificate outage is Thursday at 3pm.",
        ],
        keywords=["Salesforce Sandbox", "Connected App Review", "Workflow Canvas", "dnd kit", "Staging Performance", "Incident Review"],
        chapters=[
            SeedChapter("Salesforce integration progress", "Yesterday I got the Salesforce", [
                "Authentication against the developer sandbox works end to end",
                "Connected app review can take up to 6 weeks, so the submission starts early",
            ]),
            SeedChapter("Workflow canvas kickoff", "Yesterday I finished the dark mode", [
                "Dark mode fixes and date picker refactor merged",
                "dnd kit chosen for keyboard accessibility and a 40% smaller bundle",
                "Canvas grid and zoom controls get built while specs are finalized",
            ]),
            SeedChapter("Staging performance", "the staging environment has been really slow", [
                "Page loads of 8–10 seconds are slowing down QA",
                "Staging database upgraded to the next instance size",
            ]),
            SeedChapter("Design research & housekeeping", "Marcus, anything from design", [
                "Two more usability sessions for the step library on Thursday",
                "Q4 capacity plan updated in Linear; incident review Thursday at 3pm",
            ]),
        ],
        actions=[
            SeedAction("Draft the Salesforce connected app submission and send it to Priya for review", "Daniel Okafor", "I'll draft the submission"),
            SeedAction("Upgrade the staging database to the next instance size", "Daniel Okafor", "I'll do that right after standup", done=True),
            SeedAction("Share the final canvas specs with Emily", "Marcus Chen", "I'll have the final canvas specs", due_in_days=2),
            SeedAction("Send Emily the invite to Thursday's usability session", "Marcus Chen", "I'll send you the invite", done=True),
            SeedAction("Review Q4 assignments in Linear and flag anything wrong", None, "Please check your assignments", due_in_days=1),
            SeedAction("Add certificate expiry monitoring to the webhooks service", "Daniel Okafor", "I'll add certificate expiry monitoring", due_in_days=2),
        ],
        soundbites=[("Connected app review risk", "Salesforce requires a connected app review", "Can you start the connected app submission")],
    ),
    # ── 2 ────────────────────────────────────────────────────────────────────
    SeedMeeting(
        title="Q4 Product Roadmap Planning",
        days_ago=2,
        hour=15,
        minute=0,
        platform=Platform.GOOGLE_MEET,
        participants=[
            ("Alex Rivera", H), ("Priya Sharma", A), ("Marcus Chen", A), ("Jordan Blake", A), ("Daniel Okafor", A),
        ],
        tags=["Product", "Planning"],
        transcript="""
Alex Rivera: Morning everyone, thanks for joining. We have a lot to cover. The goal today is to lock the Q4 roadmap so engineering can start sprint planning on Monday.
Priya Sharma: Sounds good. I pulled the capacity numbers last night. We have roughly 42 engineering weeks in Q4 after holidays and on-call, which is about 15 percent less than Q3.
Alex Rivera: That's tighter than I hoped. Okay, so let's start with the three big bets we discussed last week: the workflow builder redesign, the Salesforce integration, and usage-based billing.
Jordan Blake: Before we dive in, can I share what we're hearing from the market? Because I think it changes the priority order a bit.
Alex Rivera: Please, go ahead.
Jordan Blake: So in the last 30 days we lost four deals where Salesforce integration was the deciding factor. That's about $380k in annual contract value. Sales is asking about it in every pipeline review.
Marcus Chen: That's a big number. Do we know if those customers would have churned on anything else, or was it really just the integration?
Jordan Blake: Sofia's notes say two of them explicitly said they'd sign if we had native Salesforce sync by January. The other two were more vague.
Priya Sharma: From an engineering perspective, the Salesforce integration is probably 10 to 12 engineering weeks for a solid v1. The OAuth flow and field mapping are straightforward. The hard part is bidirectional sync and handling their API rate limits.
Alex Rivera: What if we scoped v1 to one-way sync, from Orbit into Salesforce? Would that cut it down meaningfully?
Priya Sharma: Yeah, one-way sync is probably 6 to 7 weeks. Daniel built something similar at his last company.
Daniel Okafor: Right, one-way push is much simpler. We'd batch updates every 5 minutes and use the bulk API, so rate limits mostly go away. I'd want 2 weeks at the end for hardening and a beta with a couple of customers.
Alex Rivera: Okay, I like that. Let's tentatively call it: Salesforce one-way sync is priority one, targeting a beta by November 20th.
Marcus Chen: What does that mean for the workflow builder redesign? My team has already done about three weeks of research and the prototypes are testing really well.
Alex Rivera: That's the tough part. Marcus, what did the usability tests show?
Marcus Chen: We ran 12 sessions. Task completion for building a multi-step workflow went from 58 percent on the current builder to 91 percent on the new prototype. Time to first workflow dropped from about 14 minutes to under 5.
Jordan Blake: Those are great numbers. Honestly that's a story I'd love to tell at the November launch event.
Priya Sharma: The redesign is big though. The front end alone is probably 16 weeks. We could ship it incrementally behind a feature flag, starting with the new canvas and the step library.
Alex Rivera: Could we do the canvas and step library in Q4 and leave the advanced branching logic for Q1?
Priya Sharma: That's roughly 9 weeks. Combined with Salesforce at 7, we're at 16 of our 42 weeks, which leaves room for maintenance and the billing work.
Alex Rivera: What about usage-based billing? Finance has been pushing hard on it.
Priya Sharma: Billing is scary. It touches metering, invoicing, and Stripe. I'd estimate 12 weeks minimum, and I don't want to rush anything that touches money.
Jordan Blake: Do we actually need usage-based billing in Q4? What's driving the urgency?
Alex Rivera: Finance wants it before annual renewals in January, so large customers renew on the new model. But I think we could do the metering foundation in Q4 and switch pricing in Q1.
Daniel Okafor: The metering piece is a good standalone project. We need accurate usage events regardless, and it would also feed the analytics dashboard customers keep asking for.
Priya Sharma: Metering alone is about 5 weeks. So Salesforce 7, workflow canvas 9, metering 5. That's 21 weeks, and we keep around 20 percent buffer for bugs and on-call.
Alex Rivera: I think that's a plan. Does anyone feel strongly that we're making the wrong call?
Marcus Chen: I'm okay with it as long as the builder doesn't slip again. We delayed it in Q3 too, and the design team is getting a little demoralized.
Alex Rivera: That's fair, and I hear you. Let's commit to the canvas shipping to beta customers by December 12th, no matter what.
Marcus Chen: Okay. I'll finalize the canvas specs and share them with engineering by next Wednesday.
Jordan Blake: For the launch event, can we get a short demo of the new canvas even if it's in beta? A 2 minute video would be enough.
Marcus Chen: Yes, we can do a polished prototype recording. I'll coordinate with you on the storyboard.
Alex Rivera: Great. Jordan, can you also put together a customer-facing roadmap slide? Keep dates vague, quarters only.
Jordan Blake: Will do. I'll draft it and send it to you by Tuesday for review.
Priya Sharma: One more thing. For Salesforce we need a sandbox org and ideally two design partners. Do we have customers lined up?
Jordan Blake: I'll ask Sofia. I think Acme Corp and Globex both mentioned Salesforce in their last QBRs.
Alex Rivera: Let's make that an action item. Jordan, follow up with Sofia on design partners this week.
Daniel Okafor: I'll set up the Salesforce developer sandbox and start a technical spike on the bulk API tomorrow.
Priya Sharma: And I'll update the capacity plan in Linear and share the Q4 roadmap with the whole engineering team on Monday.
Alex Rivera: Perfect. So to recap: Salesforce one-way sync is priority one with a beta by November 20th, the workflow canvas ships to beta by December 12th, and we build the metering foundation this quarter with pricing changes in Q1.
Jordan Blake: What's the plan if Salesforce slips? Do we cut metering?
Alex Rivera: Yes, metering is the first thing we'd cut. The canvas date is protected.
Priya Sharma: Agreed. I'll flag any risk in the weekly engineering sync.
Alex Rivera: Great work everyone. I'll write up the decision doc and share it this afternoon. Thanks all.
""",
        gist="The team locked the Q4 roadmap: Salesforce one-way sync first, a beta of the redesigned workflow canvas, and a usage-metering foundation.",
        overview=[
            "Q4 capacity is about 42 engineering weeks, roughly 15% below Q3.",
            "Four lost deals (~$380k ACV) cited the missing Salesforce integration. V1 is scoped to one-way sync (6–7 weeks) with a beta by November 20.",
            "The workflow builder prototype raised task completion from 58% to 91%. The canvas and step library ship to beta by December 12; advanced branching moves to Q1.",
            "Usage-based billing is split: a ~5-week metering foundation in Q4 and the pricing switch in Q1. Metering is the first thing cut if Salesforce slips.",
            "Planned work totals ~21 weeks with a ~20% buffer for bugs and on-call.",
        ],
        keywords=["Q4 Roadmap", "Salesforce Integration", "Workflow Builder", "Usage-Based Billing", "Metering", "Engineering Capacity", "Launch Event"],
        chapters=[
            SeedChapter("Capacity & the three big bets", "Morning everyone, thanks for joining", [
                "About 42 engineering weeks available in Q4, 15% less than Q3",
                "Candidates: workflow builder redesign, Salesforce integration, usage-based billing",
            ]),
            SeedChapter("Market pressure for Salesforce", "can I share what we're hearing from the market", [
                "Four lost deals worth ~$380k ACV hinged on Salesforce",
                "Scoping to one-way sync cuts the estimate from 10–12 to 6–7 weeks",
                "Beta target set for November 20",
            ]),
            SeedChapter("Workflow builder redesign", "What does that mean for the workflow builder", [
                "12 usability sessions: completion 58% → 91%, time to first workflow 14 → under 5 minutes",
                "Canvas and step library in Q4 (~9 weeks); advanced branching in Q1",
            ]),
            SeedChapter("Billing & metering", "What about usage-based billing", [
                "Full billing estimated at 12+ weeks and considered high risk",
                "Metering foundation in Q4 feeds billing and the analytics dashboard",
            ]),
            SeedChapter("Commitments & recap", "I think that's a plan", [
                "Canvas beta date of December 12 is protected",
                "Launch-event demo video and customer-facing roadmap slide",
                "Metering is the first cut if Salesforce slips",
            ]),
        ],
        actions=[
            SeedAction("Finalize the workflow canvas specs and share them with engineering", "Marcus Chen", "I'll finalize the canvas specs", due_in_days=5),
            SeedAction("Coordinate the storyboard for a 2-minute canvas demo video", "Marcus Chen", "polished prototype recording"),
            SeedAction("Draft the customer-facing roadmap slide (quarters only)", "Jordan Blake", "I'll draft it and send it to you by Tuesday", due_in_days=4),
            SeedAction("Follow up with Sofia on Salesforce design partners (Acme, Globex)", "Jordan Blake", "follow up with Sofia on design partners", done=True),
            SeedAction("Set up the Salesforce developer sandbox and start the bulk API spike", "Daniel Okafor", "I'll set up the Salesforce developer sandbox", done=True),
            SeedAction("Update the capacity plan in Linear and share the Q4 roadmap with engineering", "Priya Sharma", "I'll update the capacity plan", done=True),
            SeedAction("Write up and share the Q4 roadmap decision doc", "Alex Rivera", "I'll write up the decision doc", due_in_days=0),
        ],
        comments=[
            ("we lost four deals", "Let's make sure this number is in the board deck."),
            ("We ran 12 sessions", "Can we get the raw session recordings for the research repo?"),
        ],
        soundbites=[
            ("Usability test results", "We ran 12 sessions", "We ran 12 sessions"),
            ("Final Q4 priorities", "So to recap", "Yes, metering is the first thing"),
        ],
    ),
    # ── 3 ────────────────────────────────────────────────────────────────────
    SeedMeeting(
        title="Acme Corp — Discovery Call",
        days_ago=5,
        hour=18,
        minute=0,
        platform=Platform.ZOOM,
        participants=[("Sofia Martinez", H), ("Alex Rivera", A), ("Rachel Kim", A), ("Tom Becker", A)],
        tags=["Sales", "Acme Corp"],
        transcript="""
Sofia Martinez: Hi Rachel, hi Tom, thanks for making the time today. I've got Alex from our product team with me, since you had some questions about the roadmap.
Rachel Kim: Great, thanks for having us. Tom runs our IT and security, so he'll have the technical questions.
Sofia Martinez: Perfect. To make the most of our time, could you walk us through how your operations team handles approvals today?
Rachel Kim: Sure. We have about 250 people in operations across three regions. Most approvals, things like purchase requests, vendor onboarding and contract renewals, go through email and a shared spreadsheet. It's honestly chaos.
Sofia Martinez: How long does a typical purchase approval take right now?
Rachel Kim: Anywhere from 3 days to 3 weeks. The average is around 9 days, and our CFO wants that under 48 hours by the end of next year.
Alex Rivera: That's a very common pattern. Where do things usually get stuck? Is it finding the right approver, or people just not responding?
Rachel Kim: Both, but mostly it's routing. Requests over $10,000 need finance review, anything with personal data needs legal, and people don't know the rules, so requests bounce around.
Alex Rivera: That's exactly what conditional routing in Orbit is built for. You define the rules once, like amount over 10k goes to finance, and every request follows the right path automatically.
Tom Becker: Before we get too excited, I need to understand the security side. Where is our data stored, and do you support SSO?
Sofia Martinez: Great question. We're hosted on AWS in the US and EU, and you can choose your region. We support SAML SSO with Okta, Azure AD and Google, and SCIM for provisioning.
Tom Becker: Are you SOC 2 Type II certified?
Sofia Martinez: Yes, we renewed our SOC 2 Type II in June and we're ISO 27001 certified as well. I can send you our security package and the latest pen test summary.
Tom Becker: That would help. Our security review usually takes about four weeks, so the sooner we start the better.
Rachel Kim: The other big thing for us is Salesforce. Our sales ops team lives in Salesforce, and vendor contracts are tracked there. Can Orbit push approval status into Salesforce?
Alex Rivera: I'll be transparent. Salesforce integration is our top priority this quarter. We're building one-way sync from Orbit into Salesforce, with a beta planned for late November.
Rachel Kim: One-way would actually cover most of what we need. We mainly want the approval status and approver on the contract record.
Alex Rivera: Then you might be a great design partner. Design partners get early access and a direct line to the engineering team.
Rachel Kim: I'd be interested in that. Tom, would that be a problem from your side?
Tom Becker: As long as it goes through the same security review, no. I'd want to see the permission scopes the integration requests.
Alex Rivera: Totally reasonable. I can share the draft OAuth scopes with you once they're finalized.
Sofia Martinez: Rachel, can I ask about budget and timing? When would you ideally want to be live?
Rachel Kim: We have budget approved for this fiscal year, which ends March 31st. Ideally we'd pilot with one region in January and roll out to everyone by Q2.
Sofia Martinez: And who else is involved in the decision?
Rachel Kim: Our CFO, Mark, signs off on anything over $50,000. And procurement will want three vendor quotes.
Sofia Martinez: Understood. Are you looking at other vendors right now?
Rachel Kim: We looked at two others. One was too rigid and the other didn't have a real API. Honestly, you're the front runner if the Salesforce piece works out.
Sofia Martinez: That's great to hear. For pricing, for 250 users on our Business plan we'd typically be around $60,000 a year, with a discount for a two year commitment.
Rachel Kim: That's in range. We'd need to see the ROI case for Mark, though.
Sofia Martinez: Absolutely. I'll put together an ROI model based on your 9 day average approval time and send it with a proposal.
Tom Becker: Can we also get a sandbox to test the SSO setup before we sign?
Sofia Martinez: Yes, I'll set up a trial workspace with SSO enabled for you this week.
Rachel Kim: Perfect. Can we schedule a demo for our regional ops leads? Maybe next Thursday?
Sofia Martinez: Next Thursday works. I'll send an invite for 2pm Eastern with a tailored demo of conditional routing.
Alex Rivera: And I'll send Tom the draft Salesforce OAuth scopes and our integration architecture doc.
Rachel Kim: This has been really helpful. Thanks both.
Sofia Martinez: Thank you! I'll send a recap email today with everything we discussed.
""",
        gist="Discovery call with Acme Corp: a 250-person ops team wants faster approvals, SSO/SOC 2 and Salesforce sync. Strong fit, with a pilot targeted for January.",
        overview=[
            "Acme's approvals (purchases, vendor onboarding, renewals) run on email and spreadsheets. The average approval takes 9 days against a CFO goal of under 48 hours.",
            "The main pain is routing: >$10k needs finance and personal data needs legal, a direct fit for Orbit's conditional routing.",
            "Tom (IT) requires SAML SSO, SOC 2 Type II and a ~4-week security review.",
            "One-way Salesforce sync covers Acme's needs, and they are interested in becoming a design partner.",
            "Budget is approved through March 31. Plan: pilot one region in January, full rollout in Q2. Estimated $60k/year for 250 users; Orbit is the front runner.",
        ],
        keywords=["Approval Workflows", "Conditional Routing", "SSO", "SOC 2", "Salesforce Integration", "Pricing", "Pilot", "Security Review"],
        chapters=[
            SeedChapter("Introductions & current process", "Hi Rachel, hi Tom", [
                "250 people in operations across three regions",
                "Approvals run through email and a shared spreadsheet",
                "Average approval takes 9 days; CFO wants under 48 hours",
            ]),
            SeedChapter("Approval routing pain", "Where do things usually get stuck", [
                "Rules like >$10k → finance and personal data → legal are not well known",
                "Orbit's conditional routing applies the rules automatically",
            ]),
            SeedChapter("Security & compliance", "Before we get too excited", [
                "Hosting on AWS in US or EU, SAML SSO (Okta, Azure AD, Google) and SCIM",
                "SOC 2 Type II and ISO 27001; security review takes ~4 weeks",
            ]),
            SeedChapter("Salesforce & design partnership", "The other big thing for us is Salesforce", [
                "Acme needs approval status and approver on the Salesforce contract record",
                "One-way sync is enough; Acme is open to being a design partner",
            ]),
            SeedChapter("Budget, timeline & next steps", "can I ask about budget and timing", [
                "Pilot one region in January, roll out by Q2; CFO signs off above $50k",
                "Business plan estimated at ~$60k/year with a two-year discount",
                "Tailored demo for regional ops leads next Thursday at 2pm ET",
            ]),
        ],
        actions=[
            SeedAction("Send Tom the security package and latest pen test summary", "Sofia Martinez", "I can send you our security package", done=True),
            SeedAction("Build an ROI model from the 9-day approval baseline and send a proposal", "Sofia Martinez", "I'll put together an ROI model", due_in_days=7),
            SeedAction("Set up a trial workspace with SSO enabled for Acme", "Sofia Martinez", "I'll set up a trial workspace"),
            SeedAction("Schedule the conditional-routing demo for regional ops leads (Thu 2pm ET)", "Sofia Martinez", "I'll send an invite for 2pm", done=True),
            SeedAction("Send Tom the draft Salesforce OAuth scopes and integration architecture doc", "Alex Rivera", "I'll send Tom the draft"),
            SeedAction("Send the recap email to Acme", "Sofia Martinez", "I'll send a recap email today", done=True),
        ],
        comments=[("front runner if the Salesforce piece", "Big signal — let's loop Priya in on the Salesforce beta scope.")],
        soundbites=[("Acme budget & timeline", "We have budget approved", "Our CFO, Mark, signs off")],
    ),
    # ── 4 ────────────────────────────────────────────────────────────────────
    SeedMeeting(
        title="Design Review: Onboarding Flow Redesign",
        days_ago=8,
        hour=16,
        minute=30,
        platform=Platform.GOOGLE_MEET,
        participants=[("Marcus Chen", H), ("Alex Rivera", A), ("Emily Watson", A), ("Liam O'Connor", A)],
        tags=["Design", "Onboarding"],
        transcript="""
Marcus Chen: Okay, let's get into it. Today I want feedback on the new onboarding flow before we move to high fidelity. I'll share my screen.
Alex Rivera: Before you start, can you remind us what problem we're solving? I want to make sure we evaluate against the right goal.
Marcus Chen: Sure. Right now only 34 percent of new signups create their first workflow within 7 days. Our goal is to get that to 50 percent by the end of Q1.
Liam O'Connor: That matches what I see in onboarding calls. People sign up, land on an empty dashboard, and don't know where to start.
Marcus Chen: Exactly. So the new flow has three steps. First, a short questionnaire asking about your role and what you want to automate. Second, we recommend three templates based on the answers. Third, the user customizes a template in a guided mode.
Emily Watson: How long is the questionnaire? Every extra question costs us completions.
Marcus Chen: Three questions, all multiple choice. In testing, the median completion time was 40 seconds.
Alex Rivera: I like it. What happens if someone skips the questionnaire?
Marcus Chen: They go straight to the template gallery, with the most popular templates at the top. We don't force anyone through it.
Liam O'Connor: One thing I'd push on. Many of our enterprise customers are invited by an admin, not signing up themselves. The admin has already set things up. Does this flow make sense for them?
Marcus Chen: Good point. I hadn't designed for invited users. What do they usually need?
Liam O'Connor: Mostly they need to see the workflows shared with them and learn how to approve things. They rarely build workflows in their first week.
Alex Rivera: So we need two paths: self-serve signups get the builder onboarding, and invited users get an approver-focused tour.
Marcus Chen: Agreed. I'll design a separate invited-user path. It could be as simple as a three-step product tour.
Emily Watson: From an implementation side, the guided mode is the expensive part. We'd need to add tooltips and highlight states to the builder. Is that compatible with the new canvas?
Marcus Chen: It should be. I designed the guided mode on top of the new canvas components.
Emily Watson: Then I'd suggest we ship onboarding after the canvas beta, otherwise we'd build it twice.
Alex Rivera: That makes sense. So realistically onboarding ships in January, after the canvas beta on December 12th.
Marcus Chen: That works. It gives us time to test the invited-user path too.
Liam O'Connor: Can we also add a checklist on the dashboard? Customers love seeing progress, like 3 of 5 steps complete.
Marcus Chen: I had a checklist in an earlier version but cut it for simplicity. What's your evidence that it helps?
Liam O'Connor: When we tried a manual checklist in onboarding emails last spring, activation went up about 12 percent for that cohort.
Alex Rivera: That's a decent signal. Let's bring the checklist back but keep it dismissible.
Marcus Chen: Okay, I'll add a dismissible checklist to the dashboard designs.
Emily Watson: Should we track each step as an analytics event? We'll want to know where people drop off.
Alex Rivera: Yes, definitely. Emily, can you draft the event tracking plan so we can review it with data?
Emily Watson: Sure, I'll write it up by next Monday.
Marcus Chen: On visual design, I'm using the new illustration style for the empty states. Any concerns?
Alex Rivera: They look great. Maybe make the template cards a bit more scannable, with bigger icons and shorter descriptions.
Marcus Chen: Got it. I'll iterate on the template cards and run five quick preference tests.
Liam O'Connor: I can recruit a few customers for those tests. I have a list of people who offered to help.
Marcus Chen: That would be amazing, thanks Liam.
Alex Rivera: Great session. Marcus, let's review high fidelity designs in two weeks.
Marcus Chen: Sounds good. I'll send the updated Figma link before then.
""",
        gist="Review of the new onboarding flow (questionnaire, templates, guided mode), adding an invited-user path and a dashboard checklist; ships after the canvas beta.",
        overview=[
            "Goal: raise 7-day first-workflow activation from 34% to 50% by the end of Q1.",
            "Proposed flow: a 3-question survey (~40s median), three recommended templates and guided customization. Skipping goes straight to the template gallery.",
            "Invited enterprise users need an approver-focused tour rather than builder onboarding.",
            "Onboarding ships in January, after the December 12 canvas beta, to avoid building guided mode twice.",
            "A dismissible dashboard checklist returns (a manual checklist previously lifted activation ~12%), and every step becomes an analytics event.",
        ],
        keywords=["Onboarding", "Activation", "Templates", "Guided Mode", "Invited Users", "Checklist", "Event Tracking"],
        chapters=[
            SeedChapter("Goals & current activation", "Today I want feedback on the new onboarding flow", [
                "Only 34% of signups create a workflow within 7 days; target is 50%",
                "New users land on an empty dashboard and don't know where to start",
            ]),
            SeedChapter("Proposed three-step flow", "the new flow has three steps", [
                "Questionnaire → three recommended templates → guided customization",
                "Three multiple-choice questions with a 40-second median",
            ]),
            SeedChapter("Invited users path", "Many of our enterprise customers are invited", [
                "Invited users mostly approve and rarely build in week one",
                "Separate approver-focused product tour",
            ]),
            SeedChapter("Implementation & timing", "the guided mode is the expensive part", [
                "Guided mode builds on the new canvas components",
                "Onboarding ships in January after the canvas beta",
            ]),
            SeedChapter("Checklist, analytics & visuals", "Can we also add a checklist", [
                "Dismissible checklist backed by a ~12% activation lift",
                "Track each onboarding step as an analytics event",
                "More scannable template cards, validated with five preference tests",
            ]),
        ],
        actions=[
            SeedAction("Design a separate onboarding path for invited users", "Marcus Chen", "I'll design a separate invited-user path"),
            SeedAction("Add a dismissible checklist to the dashboard designs", "Marcus Chen", "I'll add a dismissible checklist", done=True),
            SeedAction("Draft the onboarding event tracking plan", "Emily Watson", "I'll write it up by next Monday", done=True),
            SeedAction("Iterate on the template cards and run five preference tests", "Marcus Chen", "I'll iterate on the template cards"),
            SeedAction("Recruit customers for the template preference tests", "Liam O'Connor", "I can recruit a few customers", done=True),
            SeedAction("Send the updated Figma link before the high-fidelity review", "Marcus Chen", "I'll send the updated Figma link", due_in_days=13),
        ],
        soundbites=[("Checklist evidence", "When we tried a manual checklist", "Let's bring the checklist back")],
    ),
    # ── 5 ────────────────────────────────────────────────────────────────────
    SeedMeeting(
        title="Sprint 42 Retrospective",
        days_ago=9,
        hour=20,
        minute=0,
        platform=Platform.GOOGLE_MEET,
        participants=[("Priya Sharma", H), ("Daniel Okafor", A), ("Emily Watson", A), ("Marcus Chen", A)],
        tags=["Engineering", "Retro"],
        transcript="""
Priya Sharma: Welcome to the sprint 42 retro. Same format as usual: what went well, what didn't, and what we'll change. Let's start with what went well.
Emily Watson: The date picker refactor went really smoothly. Pairing with Daniel on the API changes saved us at least two days.
Daniel Okafor: Agreed, pairing worked well. Also, the new CI caching cut our build times from 14 minutes to about 6, which everyone noticed.
Marcus Chen: From design, having engineers join the usability sessions was great. The feedback loop was much shorter.
Priya Sharma: Love it. What didn't go well?
Daniel Okafor: The outage last Tuesday. The TLS certificate on the webhooks service expired and we didn't have any alerting on it. Customers noticed before we did.
Emily Watson: Also, we carried over three tickets again. I think we keep overcommitting at sprint planning.
Priya Sharma: That's the third sprint in a row with carry-over. What do people think is causing it?
Marcus Chen: Design changes coming in mid-sprint is part of it. Sorry about that.
Emily Watson: And estimates don't include code review time. Reviews have been taking a day or more.
Priya Sharma: Okay. So what do we change?
Daniel Okafor: For the outage, I want certificate expiry monitoring and a runbook. I can own that.
Emily Watson: For carry-over, let's commit to 80 percent of our velocity instead of 100 percent, and treat review time as part of the estimate.
Marcus Chen: And I'll freeze designs for a ticket before the sprint starts. Anything that changes goes to the next sprint.
Priya Sharma: Great. Let's also try a review SLA: every pull request gets a first review within four working hours.
Daniel Okafor: I'm in. Can we add a Slack reminder for stale pull requests?
Priya Sharma: Yes, I'll set up the reminder bot this week. Good retro, everyone. Thanks.
""",
        gist="Sprint 42 retro: pairing and faster CI worked; a TLS outage and recurring carry-over led to monitoring, capacity and code-review changes.",
        overview=[
            "Wins: pairing on the date picker refactor saved ~2 days, CI caching cut builds from 14 to ~6 minutes, and engineers joining usability sessions shortened the feedback loop.",
            "Issues: a webhooks outage from an expired TLS certificate with no alerting, and a third straight sprint with carry-over.",
            "Carry-over causes: mid-sprint design changes and estimates that exclude code review time.",
            "Changes: plan at 80% of velocity, freeze designs before the sprint, a 4-hour first-review SLA with a stale-PR reminder, and certificate monitoring with a runbook.",
        ],
        keywords=["Retrospective", "CI Caching", "TLS Outage", "Carry-Over", "Velocity", "Code Review SLA"],
        chapters=[
            SeedChapter("What went well", "Welcome to the sprint 42 retro", [
                "Pairing saved two days on the date picker refactor",
                "CI caching: builds from 14 to ~6 minutes",
            ]),
            SeedChapter("What didn't go well", "What didn't go well", [
                "Expired TLS certificate took down webhooks; customers noticed first",
                "Third sprint in a row with carry-over",
            ]),
            SeedChapter("Changes for next sprint", "So what do we change", [
                "Commit to 80% of velocity and include review time in estimates",
                "Design freeze before sprint start",
                "First code review within four working hours",
            ]),
        ],
        actions=[
            SeedAction("Add certificate expiry monitoring and write a runbook", "Daniel Okafor", "I want certificate expiry monitoring"),
            SeedAction("Plan the next sprint at 80% of velocity, including review time", "Emily Watson", "let's commit to 80 percent", done=True),
            SeedAction("Freeze designs for tickets before the sprint starts", "Marcus Chen", "I'll freeze designs", done=True),
            SeedAction("Set up a Slack reminder bot for stale pull requests", "Priya Sharma", "I'll set up the reminder bot", done=True),
        ],
    ),
    # ── 6 ────────────────────────────────────────────────────────────────────
    SeedMeeting(
        title="Interview: Senior Frontend Engineer — Hannah Lee",
        days_ago=12,
        hour=17,
        minute=0,
        platform=Platform.ZOOM,
        participants=[("Priya Sharma", H), ("Emily Watson", A), ("Hannah Lee", A)],
        tags=["Hiring"],
        transcript="""
Priya Sharma: Hi Hannah, welcome, and thanks for taking the time. I'm Priya, I lead engineering here, and this is Emily, one of our senior frontend engineers.
Emily Watson: Hi Hannah, nice to meet you.
Hannah Lee: Nice to meet you both. Thanks for having me.
Priya Sharma: The plan for today: we'll talk about your background, then go deeper on a couple of technical topics, and leave time for your questions. Sound good?
Hannah Lee: Sounds great.
Priya Sharma: Could you start by telling us about your current role and a project you're proud of?
Hannah Lee: Sure. I'm a senior frontend engineer at a logistics startup, on a team of six. The project I'm proudest of is a route planning interface where dispatchers drag deliveries between drivers on a live map. We had to render up to 5,000 stops without the page freezing.
Emily Watson: That's a hard problem. How did you keep it fast?
Hannah Lee: A few things. We virtualized the stop list, moved the route optimization into a web worker, and batched map updates with requestAnimationFrame. Interaction latency went from about 800 milliseconds to under 100.
Emily Watson: Nice. How did you measure that? Was it lab data or real users?
Hannah Lee: Both. We used the performance API to log interaction timings from real sessions, and we had a Playwright benchmark in CI that failed the build if latency regressed by more than 20 percent.
Priya Sharma: I love that you put it in CI. How did the team feel about a build failing on performance?
Hannah Lee: Honestly, there was some pushback at first. We tuned the threshold and added a way to override it with a comment explaining why. After a month, people liked it because it caught real regressions.
Emily Watson: Let's talk about state management. Our workflow builder has a lot of nested state. How do you decide between local state, context, and a store?
Hannah Lee: I start local and only lift state when two distant components need it. For something like a workflow graph, I'd keep the graph in a normalized store, with nodes and edges keyed by id, and derive everything else with selectors. Otherwise undo and redo become painful.
Emily Watson: Funny you mention undo. How would you implement undo in a builder like ours?
Hannah Lee: I'd model changes as commands or patches instead of snapshots. Immer patches work well for that. Each user action produces a patch and its inverse, so undo is just applying the inverse. It also makes collaboration easier later.
Priya Sharma: How do you approach accessibility on drag and drop interfaces?
Hannah Lee: Drag and drop always needs a keyboard alternative. On the route planner we added a move-to menu and announced changes through a live region. We tested with VoiceOver every sprint.
Emily Watson: That's great. We just picked dnd kit partly for its keyboard support.
Hannah Lee: Good choice, I've used it. The sensors API is really flexible.
Priya Sharma: Tell us about a time you disagreed with a product or design decision.
Hannah Lee: Our designer wanted an animated map transition on every filter change. It looked nice but made the app feel slow for power users. I built both versions, we ran a quick test with five dispatchers, and we ended up keeping the animation only on first load.
Priya Sharma: That's a great example of resolving it with data. Okay, let's open it up. What questions do you have for us?
Hannah Lee: What does success look like for this role in the first 90 days?
Priya Sharma: In the first 90 days, we'd want you to own a significant part of the new workflow canvas, ideally the undo and redo system and performance, and to be shipping to beta customers by December.
Hannah Lee: And how is the frontend team structured? How many engineers?
Emily Watson: There are four frontend engineers today, and we're hiring two more. We work in cross-functional squads with design and backend.
Hannah Lee: What's the on-call rotation like?
Priya Sharma: Everyone on the product team is on call about one week every two months, with a secondary for backup. Incidents are rare, maybe two pages a month.
Hannah Lee: That sounds reasonable. Thanks, this has been a great conversation.
Priya Sharma: Thank you Hannah. Our recruiter will be in touch within two or three days about next steps.
Emily Watson: Great talking to you, Hannah.
Priya Sharma: Okay, she dropped off. Quick debrief, Emily, what's your read?
Emily Watson: Strong hire from me. Her answers on performance and undo were exactly what we need for the canvas. I'd want to see her system design round, but I'm very positive.
Priya Sharma: Same. I'll submit my scorecard today and recommend moving her to the system design interview.
Emily Watson: I'll submit mine this afternoon too.
""",
        gist="Strong senior frontend interview: Hannah Lee showed deep performance, state-management and accessibility experience; both interviewers recommend advancing her.",
        overview=[
            "Hannah built a route planner rendering 5,000 stops and cut interaction latency from ~800ms to under 100ms (virtualization, a web worker, rAF batching), guarded by a CI performance budget.",
            "She recommends a normalized store for graph state and patch-based undo/redo with Immer — directly applicable to the workflow canvas.",
            "She treats keyboard alternatives and live-region announcements as mandatory for drag and drop, and has used dnd kit.",
            "She resolved a design disagreement by testing both versions with users.",
            "Debrief: Priya and Emily both lean strong hire; the next step is the system design round.",
        ],
        keywords=["Frontend Performance", "State Management", "Undo/Redo", "Accessibility", "Drag And Drop", "Hiring"],
        chapters=[
            SeedChapter("Introductions & background", "Hi Hannah, welcome", [
                "Senior frontend engineer at a logistics startup, team of six",
                "Route planner rendering up to 5,000 stops on a live map",
            ]),
            SeedChapter("Performance deep dive", "That's a hard problem", [
                "Virtualization, web worker and requestAnimationFrame batching",
                "Latency from ~800ms to under 100ms, enforced by a Playwright benchmark in CI",
            ]),
            SeedChapter("State management & undo", "Let's talk about state management", [
                "Start local; normalized store for graph data with selectors",
                "Undo/redo via Immer patches and their inverses",
            ]),
            SeedChapter("Accessibility & collaboration", "How do you approach accessibility", [
                "Keyboard alternative and live-region announcements for drag and drop",
                "Settled an animation debate with a five-person user test",
            ]),
            SeedChapter("Candidate questions", "What questions do you have for us", [
                "First 90 days: own canvas undo/redo and performance",
                "Four frontend engineers today, hiring two more; light on-call",
            ]),
            SeedChapter("Interviewer debrief", "Quick debrief", [
                "Both interviewers lean strong hire",
                "Move to the system design interview",
            ]),
        ],
        actions=[
            SeedAction("Submit scorecard and recommend the system design round", "Priya Sharma", "I'll submit my scorecard today", done=True),
            SeedAction("Submit interview scorecard for Hannah Lee", "Emily Watson", "I'll submit mine this afternoon", done=True),
            SeedAction("Have the recruiter contact Hannah about next steps", None, "Our recruiter will be in touch", due_in_days=3),
        ],
        comments=[("Immer patches work well", "Exactly the approach we sketched for the canvas. +1")],
    ),
    # ── 7 ────────────────────────────────────────────────────────────────────
    SeedMeeting(
        title="Fall Launch Campaign Kickoff",
        days_ago=15,
        hour=14,
        minute=0,
        platform=Platform.TEAMS,
        participants=[("Jordan Blake", H), ("Alex Rivera", A), ("Marcus Chen", A), ("Sofia Martinez", A)],
        tags=["Marketing", "Launch"],
        transcript="""
Jordan Blake: Alright, welcome to the fall launch kickoff. The launch event is on November 6th, so we have about seven weeks. Today I want to align on the story, the channels, and who owns what.
Alex Rivera: Great. What's the headline you're thinking?
Jordan Blake: Working title is "Automate the busywork." The idea is that Orbit removes the approvals and hand-offs that slow teams down. The hero features would be the new workflow canvas preview and the Salesforce integration.
Sofia Martinez: From sales, Salesforce is the one prospects will care about most. I'd lead with it for enterprise audiences.
Jordan Blake: Agreed, we'll segment the messaging. Enterprise gets Salesforce and security first, mid-market gets the canvas and templates.
Marcus Chen: Just flagging that the canvas will still be in beta on November 6th. We should be careful not to promise general availability.
Jordan Blake: Good point. We'll call it an early access preview with a waitlist. That actually helps us collect leads.
Alex Rivera: I like the waitlist. What's the target for signups?
Jordan Blake: I'm aiming for 2,000 waitlist signups in the first two weeks, and 150 sales qualified leads by the end of the quarter.
Sofia Martinez: 150 SQLs is ambitious. Last launch we got about 90. What's different this time?
Jordan Blake: Two things. We're co-marketing with two partners, and we're running a webinar series with customers instead of just a single event. Plus paid social budget is up 30 percent.
Alex Rivera: What's the total budget?
Jordan Blake: $85,000 for the quarter. About $40,000 goes to paid, $25,000 to the event and webinars, and the rest to content and design.
Marcus Chen: For design, what assets do you need from my team?
Jordan Blake: A launch landing page, social templates, the product demo video, and updated screenshots across the website. The landing page is the priority.
Marcus Chen: The landing page we can do in two weeks. The demo video depends on the canvas prototype, so that's more like four weeks.
Jordan Blake: That works if we have the landing page by October 10th. We'll start the waitlist campaign then.
Marcus Chen: Okay, landing page by October 10th. I'll assign a designer this week.
Sofia Martinez: Can we get a customer story for Salesforce? Something from a design partner would be powerful.
Alex Rivera: We're talking to Acme Corp and Globex about being design partners. It's early, but if the beta goes well, one of them might agree to a quote.
Jordan Blake: Even a quote would be great. Sofia, could you ask your contacts at Acme whether they'd be open to a case study later?
Sofia Martinez: Yes, I'll bring it up after their pilot kicks off.
Alex Rivera: One risk: if the Salesforce beta slips, the enterprise message falls apart. Do we have a backup?
Jordan Blake: The backup would be leading with security and SSO for enterprise. Not as exciting, but it's solid.
Alex Rivera: Okay. Let's make the go or no-go decision on Salesforce messaging on October 20th, based on beta readiness.
Jordan Blake: Agreed. I'll put that date in the launch plan. So owners: I'll finalize the messaging doc and the launch plan by Friday. Marcus owns the landing page and video. Sofia owns sales enablement, so the pitch deck and battle cards.
Sofia Martinez: I'll have the updated pitch deck ready two weeks before launch.
Alex Rivera: And I'll review the messaging doc for accuracy on the roadmap claims.
Jordan Blake: Perfect, thanks everyone. Let's make this our best launch yet.
""",
        gist="Kickoff for the November 6 fall launch: an “Automate the busywork” story, segmented messaging, an $85k budget and a 2,000-signup waitlist goal.",
        overview=[
            "The launch event is November 6. Headline: “Automate the busywork”, with the workflow canvas preview and Salesforce integration as hero features.",
            "Messaging is segmented: enterprise leads with Salesforce and security, mid-market with the canvas and templates. The canvas is positioned as early access with a waitlist.",
            "Targets: 2,000 waitlist signups in two weeks and 150 SQLs by end of quarter (last launch: ~90).",
            "Budget: $85k — $40k paid, $25k events and webinars, the rest content and design.",
            "Go/no-go on Salesforce messaging is October 20, with security/SSO-led enterprise messaging as the fallback.",
        ],
        keywords=["Fall Launch", "Messaging", "Waitlist", "Landing Page", "Marketing Budget", "Sales Enablement"],
        chapters=[
            SeedChapter("Launch story & headline", "welcome to the fall launch kickoff", [
                "Launch event November 6, about seven weeks out",
                "“Automate the busywork” with canvas preview and Salesforce as heroes",
            ]),
            SeedChapter("Audience segmentation", "Salesforce is the one prospects", [
                "Enterprise: Salesforce and security; mid-market: canvas and templates",
                "Canvas framed as an early access preview with a waitlist",
            ]),
            SeedChapter("Goals & budget", "What's the target for signups", [
                "2,000 waitlist signups and 150 SQLs",
                "Partners, a webinar series and +30% paid social",
                "$85k total budget",
            ]),
            SeedChapter("Design deliverables", "what assets do you need", [
                "Landing page by October 10; demo video in ~4 weeks",
                "Social templates and refreshed website screenshots",
            ]),
            SeedChapter("Risks & owners", "One risk: if the Salesforce beta slips", [
                "Fallback: lead enterprise messaging with security and SSO",
                "Salesforce messaging go/no-go on October 20",
            ]),
        ],
        actions=[
            SeedAction("Deliver the launch landing page by October 10", "Marcus Chen", "landing page by October 10th", due_in_days=25),
            SeedAction("Finalize the messaging doc and launch plan", "Jordan Blake", "I'll finalize the messaging doc", done=True),
            SeedAction("Ask Acme contacts whether they'd do a case study later", "Sofia Martinez", "I'll bring it up after their pilot"),
            SeedAction("Prepare the updated pitch deck and battle cards", "Sofia Martinez", "I'll have the updated pitch deck ready", due_in_days=38),
            SeedAction("Review the messaging doc for roadmap accuracy", "Alex Rivera", "I'll review the messaging doc", done=True),
        ],
        soundbites=[("Launch goals & budget", "I'm aiming for 2,000 waitlist signups", "$85,000 for the quarter")],
    ),
    # ── 8 ────────────────────────────────────────────────────────────────────
    SeedMeeting(
        title="Globex — Quarterly Business Review",
        days_ago=20,
        hour=19,
        minute=30,
        platform=Platform.ZOOM,
        participants=[("Liam O'Connor", H), ("David Park", A), ("Maria Gonzalez", A)],
        tags=["Customer Success", "Globex"],
        transcript="""
Liam O'Connor: Hi David, hi Maria, thanks for joining your quarterly business review. The plan is to review usage, talk about what's working and what isn't, and look ahead to your renewal in January.
David Park: Sounds good. Maria's been running most of the day-to-day, so she'll have a lot of the details.
Liam O'Connor: Great. Let's start with usage. You're at 180 active users out of 220 licensed seats, which is about 82 percent. That's up from 65 percent last quarter.
Maria Gonzalez: That tracks. We rolled Orbit out to the support escalations team in July, and adoption there has been really strong.
Liam O'Connor: That's great to hear. Your team ran about 14,000 workflows last quarter, and average approval time dropped from 2 days to 6 hours.
David Park: Those are the numbers I show my leadership, so thank you for pulling them.
Liam O'Connor: What's working well from your side?
Maria Gonzalez: The escalation workflow is the big win. Before Orbit, escalations sat in a shared inbox. Now they route to the right tier automatically and we can see the SLA status.
David Park: And the audit trail. Our compliance team loves that every approval is logged.
Liam O'Connor: And what's not working?
Maria Gonzalez: Two things. First, the mobile experience. Our field managers approve things on their phones, and the mobile web app is clunky. Buttons are small and it logs them out constantly.
Liam O'Connor: I've heard that from other customers too. Can you tell me more about the logouts? How often?
Maria Gonzalez: Maybe every day. They have to sign in with SSO again, which on a phone is painful.
Liam O'Connor: That sounds like a session timeout setting. I'll check with our engineering team, because I believe admins can extend it. If not, I'll file it as a bug.
David Park: The second thing is reporting. I want a monthly report of approval times by team that I can send to leadership, without exporting to Excel every time.
Liam O'Connor: Scheduled reports are on our roadmap. I don't have a date yet, but I'll find out and get back to you.
David Park: That would really help with the renewal conversation internally, honestly.
Liam O'Connor: Understood. Speaking of the renewal, is there anything that would change your seat count?
David Park: We're thinking about expanding to the procurement team, which is another 60 people. But I'd need the Salesforce integration first, since procurement tracks vendors in Salesforce.
Liam O'Connor: Good news there, Salesforce integration is in development now, with a beta planned later this year. Would you be interested in being a design partner?
David Park: Yes, definitely. Put us down.
Liam O'Connor: Great. I'll connect you with our product team. And I'll send over a renewal proposal that includes the 60 procurement seats as an option.
Maria Gonzalez: Could we also get some training for the procurement team if we expand?
Liam O'Connor: Absolutely. We include two live training sessions with any expansion. I'll add that to the proposal.
David Park: Perfect. This was helpful, Liam.
Liam O'Connor: Thanks both. I'll send a summary with the action items by end of day.
""",
        gist="Globex QBR: seat usage up to 82% and approvals down from 2 days to 6 hours; mobile logouts and reporting gaps; a 60-seat expansion depends on Salesforce.",
        overview=[
            "180 of 220 seats are active (82%, up from 65%). Globex ran ~14,000 workflows last quarter and cut average approval time from 2 days to 6 hours.",
            "Wins: automated escalation routing with SLA visibility, and the audit trail valued by compliance.",
            "Pain points: a clunky mobile web experience with daily SSO logouts, and no scheduled monthly reporting on approval times.",
            "Renewal is in January. Expanding to procurement (+60 seats) depends on the Salesforce integration; Globex agreed to be a design partner.",
        ],
        keywords=["QBR", "Seat Utilization", "Escalation Workflows", "Mobile Experience", "Scheduled Reports", "Renewal", "Expansion"],
        chapters=[
            SeedChapter("Usage review", "Let's start with usage", [
                "180 of 220 seats active (82%), up from 65%",
                "~14,000 workflows; approvals from 2 days to 6 hours",
            ]),
            SeedChapter("What's working", "What's working well", [
                "Escalations route to the right tier automatically with SLA status",
                "Compliance relies on the approval audit trail",
            ]),
            SeedChapter("Pain points: mobile & reporting", "And what's not working", [
                "Small buttons and daily SSO logouts on mobile",
                "Leadership needs a monthly approval-time report without Excel",
            ]),
            SeedChapter("Renewal & expansion", "Speaking of the renewal", [
                "Procurement expansion (+60 seats) hinges on Salesforce",
                "Globex joins as a Salesforce design partner; training included with expansion",
            ]),
        ],
        actions=[
            SeedAction("Check session timeout settings for mobile SSO logouts and file a bug if needed", "Liam O'Connor", "That sounds like a session timeout setting"),
            SeedAction("Find out the timeline for scheduled reports", "Liam O'Connor", "Scheduled reports are on our roadmap"),
            SeedAction("Introduce Globex to the product team as a Salesforce design partner", "Liam O'Connor", "I'll connect you with our product team", done=True),
            SeedAction("Send a renewal proposal with 60 optional procurement seats and training", "Liam O'Connor", "I'll add that to the proposal", due_in_days=14),
            SeedAction("Send the QBR summary with action items", "Liam O'Connor", "I'll send a summary with the action items", done=True),
        ],
        comments=[("logs them out constantly", "Same complaint from two other accounts this month — worth prioritizing.")],
    ),
]
