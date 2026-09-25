import json

import pytest

from app.services.transcript_parser import TranscriptParseError, detect_format, parse_transcript


def test_txt_with_and_without_timestamps() -> None:
    segments = parse_transcript(
        "[00:00:05] Ana Lopez: Hello team.\n"
        "Continuing the same thought.\n"
        "[00:00:12] Ben Ode: Hi Ana, can you share the numbers?\n",
        "txt",
    )
    assert [s.speaker for s in segments] == ["Ana Lopez", "Ben Ode"]
    assert segments[0].text == "Hello team. Continuing the same thought."
    assert segments[0].start_ms == 5000
    assert segments[1].start_ms == 12000
    assert segments[0].end_ms <= segments[1].start_ms


def test_txt_prose_with_colon_is_not_a_speaker() -> None:
    segments = parse_transcript("Ana: So the plan is: we ship on Friday.\nSo the plan is: keep going.", "txt")
    assert len(segments) == 1
    assert segments[0].speaker == "Ana"


def test_estimated_timings_are_monotonic() -> None:
    segments = parse_transcript("A: one two three four five\nB: six seven\nA: eight nine ten", "txt")
    starts = [s.start_ms for s in segments]
    assert starts == sorted(starts)
    assert all(s.end_ms > s.start_ms for s in segments)


def test_vtt_voice_tags_and_merging() -> None:
    vtt = (
        "WEBVTT\n\n"
        "00:00:01.000 --> 00:00:03.000\n<v Ana Lopez>Hello there.</v>\n\n"
        "00:00:03.200 --> 00:00:05.000\n<v Ana Lopez>Second cue.</v>\n\n"
        "00:00:06.000 --> 00:00:08.500\n<v Ben Ode>Reply.</v>\n"
    )
    segments = parse_transcript(vtt, filename="call.vtt")
    assert [(s.speaker, s.text) for s in segments] == [("Ana Lopez", "Hello there. Second cue."), ("Ben Ode", "Reply.")]
    assert segments[0].start_ms == 1000 and segments[0].end_ms == 5000


def test_srt_with_speaker_prefix() -> None:
    srt = "1\n00:00:01,000 --> 00:00:02,500\nAna: Hi\n\n2\n00:00:03,000 --> 00:00:04,000\nBen: Hello\n"
    segments = parse_transcript(srt, filename="call.srt")
    assert [s.speaker for s in segments] == ["Ana", "Ben"]
    assert segments[1].start_ms == 3000


def test_json_seconds_and_nested_shape() -> None:
    payload = {"segments": [{"speaker": "Ana", "text": "Hi", "start": 0.5, "end": 1.5}, {"speaker": "Ben", "text": "Yo", "start": 2, "end": 3}]}
    segments = parse_transcript(json.dumps(payload), filename="x.json")
    assert [(s.start_ms, s.end_ms) for s in segments] == [(500, 1500), (2000, 3000)]


def test_detect_format() -> None:
    assert detect_format(None, "WEBVTT\n\n") == "vtt"
    assert detect_format(None, '[{"text": "x"}]') == "json"
    assert detect_format("notes.txt", "whatever") == "txt"


def test_empty_and_invalid_inputs() -> None:
    with pytest.raises(TranscriptParseError):
        parse_transcript("   ")
    with pytest.raises(TranscriptParseError):
        parse_transcript("{not json", "json")
