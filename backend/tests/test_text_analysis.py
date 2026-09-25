from app.services.summarizer import SegmentInput, heuristic_summary
from app.services.text_analysis import extract_action_items, extract_keywords, segment_flags


def test_action_items_rewrite_pronouns_and_assign_owner() -> None:
    items = extract_action_items(
        [
            ("Sam Rivera", "I'll enable the beta today and send you a setup guide by tomorrow morning."),
            ("Sam Rivera", "I'll send over a quote so you have it for budgeting."),
            ("Nina Patel", "Grace, can you mock up the mobile tabs version by Wednesday?"),
            ("Omar Haddad", "I'll share my screen."),
        ],
        participants=["Sam Rivera", "Nina Patel", "Grace Liu", "Omar Haddad"],
    )
    tasks = {i.text: i.assignee for i in items}
    assert tasks["Enable the beta today and send them a setup guide by tomorrow morning"] == "Sam Rivera"
    assert tasks["Send over a quote so they have it for budgeting"] == "Sam Rivera"
    assert tasks["Mock up the mobile tabs version by Wednesday"] == "Grace Liu"
    assert not any("screen" in t.lower() for t in tasks)  # meeting chatter is ignored


def test_keywords_keep_casing_and_skip_names() -> None:
    texts = ["We need Salesforce sync.", "Salesforce sync is priority one.", "Ask Priya about Salesforce."]
    keywords = extract_keywords(texts, exclude={"priya"})
    assert keywords[0] == "Salesforce Sync"
    assert all("Priya" not in k for k in keywords)


def test_segment_flags() -> None:
    assert segment_flags("Can we ship by Friday?") == ["question", "date"]
    assert segment_flags("Conversion went up 12 percent.") == ["metric"]
    assert segment_flags("Sounds good.") == []


def test_heuristic_summary_shape() -> None:
    segments = [
        SegmentInput("Ana", "The pricing page converts at 2.4 percent. The pricing table is dense.", 0, 6000),
        SegmentInput("Ben", "Let's test a new pricing table layout with two variants.", 6500, 12000),
        SegmentInput("Ana", "I'll set up the pricing experiment and share results next week.", 12500, 18000),
    ]
    draft = heuristic_summary("Pricing review", segments, ["Ana", "Ben"])
    assert "pricing" in draft.gist.lower()
    assert draft.overview.startswith("- Ana and Ben met for about 1 minute")
    assert draft.chapters and draft.chapters[0].start_ms == 0
    assert [a.assignee for a in draft.action_items] == ["Ana"]
