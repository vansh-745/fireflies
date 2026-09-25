"""Lightweight, dependency-free NLP helpers used by the heuristic summarizer,
the Smart Search filters and the offline AskFred fallback."""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass

STOPWORDS = frozenset(
    """
    a about above after again against all almost also am an and any are aren't around as at be because been
    before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing don't
    down during each else even ever every few for from further get gets getting got had hadn't has hasn't have
    haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've
    if in into is isn't it it's its itself just let let's lot lots me might more most much must mustn't my myself
    need needs no nor not now of off on once one only or other ought our ours ourselves out over own per quite
    rather really same say said says see seem seems shall shan't she she'd she'll she's should shouldn't so some
    something still such sure than that that's the their theirs them themselves then there there's these they
    they'd they'll they're they've thing things think this those though through thus to too under until up upon
    us very was wasn't way we we'd we'll we're we've well were weren't what what's when when's where where's
    whether which while who who's whom why why's will with within without won't would wouldn't yes yet you
    you'd you'll you're you've your yours yourself yourselves yeah yep okay ok um uh hmm mm like actually
    basically gonna wanna gotta kind sort maybe probably definitely totally right great good cool awesome
    thanks thank guys everyone folks today tomorrow week weeks going go goes went come coming know knew want
    wanted make makes made take takes took look looking looks mean means meant pretty able little bit via also
    etc anything everything nothing anyone someone first second next last new old big small many much time
    times day days year years quick quickly start started point points part parts back yet already
    send sends sent share shared sounds perfect help helpful love hear feel honestly happy agree agreed
    question questions talk talking walk plus usually typically ideally anyway else two three four five six
    seven eight nine ten monday tuesday wednesday thursday friday saturday sunday
    """.split()
)

_WORD = re.compile(r"[A-Za-z][A-Za-z'\-]+")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])")


def words(text: str) -> list[str]:
    return [w.lower().strip("'-") for w in _WORD.findall(text)]


def content_words(text: str) -> list[str]:
    return [w for w in words(text) if len(w) > 2 and w not in STOPWORDS]


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]


# ── Keywords ─────────────────────────────────────────────────────────────────


def extract_keywords(texts: Iterable[str], limit: int = 8, exclude: Iterable[str] = ()) -> list[str]:
    """Frequent content words and two-word phrases, phrases preferred.

    ``exclude`` removes e.g. participant names so they don't dominate keywords.
    Keywords keep the casing used in the transcript ("Salesforce", "OAuth").
    """
    excluded = {e.lower() for e in exclude}
    unigrams: Counter[str] = Counter()
    bigrams: Counter[str] = Counter()
    surface: dict[str, Counter[str]] = {}

    for text in texts:
        for sentence in split_sentences(text):
            raw = [w.strip("'-") for w in _WORD.findall(sentence)]
            pairs = [(w.lower(), w) for w in raw if w.lower() not in excluded]
            for low, original in pairs:
                if len(low) > 3 and low not in STOPWORDS:
                    unigrams[low] += 1
                    surface.setdefault(low, Counter())[original] += 1
            for (a, a_raw), (b, b_raw) in zip(pairs, pairs[1:]):
                if a not in STOPWORDS and b not in STOPWORDS and len(a) > 2 and len(b) > 2:
                    bigrams[f"{a} {b}"] += 1
                    surface.setdefault(f"{a} {b}", Counter())[f"{a_raw} {b_raw}"] += 1

    scored: list[tuple[float, str]] = []
    for phrase, count in bigrams.items():
        if count >= 2:
            scored.append((count * 2.2, phrase))
    for word, count in unigrams.items():
        if count >= 2:
            scored.append((float(count), word))
    scored.sort(key=lambda item: (-item[0], item[1]))

    chosen: list[str] = []
    for _, phrase in scored:
        parts = phrase.split()
        # Skip a single word already covered by a chosen phrase (and vice versa).
        if any(p in chosen for p in parts) or any(phrase in c.split() for c in chosen):
            continue
        chosen.append(phrase)
        if len(chosen) >= limit:
            break
    return [_display(surface[k].most_common(1)[0][0]) for k in chosen]


def _display(phrase: str) -> str:
    """Capitalise plain words but leave brand/acronym casing ("OAuth", "SOC") alone."""
    return " ".join(w if any(c.isupper() for c in w[1:]) else w[:1].upper() + w[1:] for w in phrase.split())


# ── Sentence ranking ─────────────────────────────────────────────────────────


@dataclass
class RankedSentence:
    text: str
    speaker: str
    segment_index: int
    score: float


def rank_sentences(segments: list[tuple[str, str]], keywords: Iterable[str] = ()) -> list[RankedSentence]:
    """Score each sentence of ``(speaker, text)`` segments by content-word frequency."""
    freq: Counter[str] = Counter()
    for _, text in segments:
        freq.update(content_words(text))
    if not freq:
        return []
    top = max(freq.values())
    keyword_tokens = {w for k in keywords for w in k.lower().split()}

    ranked: list[RankedSentence] = []
    for index, (speaker, text) in enumerate(segments):
        for sentence in split_sentences(text):
            tokens = content_words(sentence)
            if len(words(sentence)) < 7 or not tokens:
                continue
            score = sum(freq[t] / top for t in tokens) / (len(tokens) ** 0.6)
            score += 0.25 * sum(1 for t in tokens if t in keyword_tokens)
            if sentence.endswith("?"):
                score *= 0.6
            ranked.append(RankedSentence(sentence, speaker, index, score))
    ranked.sort(key=lambda r: -r.score)
    return ranked


# ── Action items ─────────────────────────────────────────────────────────────


@dataclass
class ActionCandidate:
    text: str
    assignee: str | None
    segment_index: int


_SELF_COMMIT = re.compile(
    r"\b(?:I'll|I will|I'm going to|I am going to|I can|let me|I'll go ahead and|I'm gonna)\s+(?:go ahead and\s+|also\s+|just\s+)?(?P<task>[a-z].+)",
    re.IGNORECASE,
)
_REQUEST = re.compile(r"^(?P<name>[A-Z][a-z]+),?\s+(?:can|could|would|will) you(?: please)?\s+(?P<task>.+)", re.IGNORECASE)
_TEAM_TASK = re.compile(
    r"\b(?:action item(?: is)?[:,]?|we need to|we'll need to|we should|let's make sure(?: we)?|someone needs to|follow up (?:on|with))\s+(?P<task>.+)",
    re.IGNORECASE,
)
_TASK_VERBS = frozenset(
    "send share schedule set draft write update review follow finalize prepare create book reach loop sync put "
    "add fix ship check confirm test run circulate publish post file look dig pull build own organize document "
    "email call ping talk set-up get order move migrate audit clean investigate enable turn give make start finish "
    "coordinate connect introduce recruit submit deliver invite arrange remind handle plan bump assign".split()
)


def extract_action_items(segments: list[tuple[str, str]], participants: Iterable[str] = ()) -> list[ActionCandidate]:
    first_names = {p.split()[0].lower(): p for p in participants if p}
    found: list[ActionCandidate] = []
    seen: set[str] = set()

    for index, (speaker, text) in enumerate(segments):
        for sentence in split_sentences(text):
            candidate: tuple[str, str | None] | None = None
            direct_request = False
            if match := _REQUEST.match(sentence):
                person = first_names.get(match.group("name").lower())
                if person:
                    candidate = (match.group("task"), person)
                    direct_request = True
            if candidate is None and (match := _SELF_COMMIT.search(sentence)):
                candidate = (match.group("task"), speaker)
            if candidate is None and (match := _TEAM_TASK.search(sentence)):
                candidate = (match.group("task"), None)
            if candidate is None:
                continue

            # "Grace, can you …" is a task whatever the verb; otherwise require an action verb.
            task = _clean_task(candidate[0], require_verb=not direct_request)
            if not task:
                continue
            key = " ".join(content_words(task))[:60]
            if key in seen:
                continue
            seen.add(key)
            found.append(ActionCandidate(task, candidate[1], index))
    return found


_VAGUE_OBJECT = re.compile(r"^\w+ (?:it|that|this|those|these)\b", re.IGNORECASE)
_MEETING_CHATTER = re.compile(r"\b(?:screen|slides? now|recording|mute|camera)\b", re.IGNORECASE)


def _clean_task(task: str, require_verb: bool = True) -> str | None:
    task = task.strip().rstrip(".?!,;").strip()
    task = re.sub(r"\b(?:I think|you know|like|basically)\b,?\s*", "", task, flags=re.IGNORECASE)
    # Keep the first clause: "send the report, and right now …" → "send the report".
    task = re.split(r",\s+(?:and|but|so|because)\s+|;\s+", task, maxsplit=1)[0]
    # First person → third person; "you" (the other party) → "they" as a subject, "them" otherwise.
    replacements = (
        (r"\bmy\b", "their"),
        (r"\bme\b", "them"),
        (r"\byour\b", "their"),
        (r"\byou(?=\s+(?:have|can|could|are|need|get|will|want|should|know|see|like)\b)", "they"),
        (r"\byou\b", "them"),
    )
    for pattern, replacement in replacements:
        task = re.sub(pattern, replacement, task)
    first = task.split(" ", 1)[0].lower() if task else ""
    if (require_verb and first not in _TASK_VERBS) or len(task.split()) < 3 or len(task) > 180:
        return None
    if _VAGUE_OBJECT.match(task) or _MEETING_CHATTER.search(task):
        return None
    return task[0].upper() + task[1:]


# ── Smart Search filters ─────────────────────────────────────────────────────

_METRIC = re.compile(
    r"(\$\s?\d[\d,.]*\s?[kKmMbB]?|\b\d[\d,.]*\s?(?:%|percent|k\b|million|billion|thousand|users|customers|seats|hours|days|weeks|ms|x\b))",
    re.IGNORECASE,
)
_DATE = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|next week|next month|"
    r"end of (?:the )?(?:day|week|month|quarter|year)|eod|eow|q[1-4]|january|february|march|april|june|july|"
    r"august|september|october|november|december|\d{1,2}(?:st|nd|rd|th)\b|by \d{1,2}(?::\d{2})?\s?(?:am|pm))\b",
    re.IGNORECASE,
)


def segment_flags(text: str) -> list[str]:
    flags = []
    if "?" in text:
        flags.append("question")
    if _METRIC.search(text):
        flags.append("metric")
    if _DATE.search(text):
        flags.append("date")
    return flags
