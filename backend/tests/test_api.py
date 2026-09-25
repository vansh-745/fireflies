from fastapi.testclient import TestClient

TRANSCRIPT = """\
Nora Hale: Thanks for joining the budget review. We need to finalize the Q1 marketing budget today.
Omar Said: I looked at the numbers. Paid search spend was $42,000 last quarter with a 3.1 percent conversion rate.
Nora Hale: Omar, can you prepare a breakdown of paid search by campaign before Friday?
Omar Said: Sure, I'll send the breakdown by Thursday afternoon.
Nora Hale: Great. I'll draft the budget proposal and share it with finance next week.
"""


def test_seeded_library_lists_newest_first(client: TestClient) -> None:
    body = client.get("/api/meetings").json()
    assert body["total"] >= 8
    dates = [m["started_at"] for m in body["items"]]
    assert dates == sorted(dates, reverse=True)
    oldest = client.get("/api/meetings", params={"sort": "oldest"}).json()["items"]
    assert oldest[0]["started_at"] == min(dates)


def test_filters_by_title_participant_tag_and_date(client: TestClient) -> None:
    assert client.get("/api/meetings", params={"q": "acme"}).json()["items"][0]["title"].startswith("Acme")
    # Participant name search
    hannah = client.get("/api/meetings", params={"q": "Hannah"}).json()["items"]
    assert [m["title"] for m in hannah] == ["Interview: Senior Frontend Engineer — Hannah Lee"]

    people = client.get("/api/people").json()
    priya = next(p for p in people if p["name"] == "Priya Sharma")
    by_person = client.get("/api/meetings", params={"person_id": priya["id"]}).json()
    assert by_person["total"] == priya["meeting_count"]

    tags = client.get("/api/tags").json()
    hiring = next(t for t in tags if t["name"] == "Hiring")
    assert client.get("/api/meetings", params={"tag_id": hiring["id"]}).json()["total"] == 1

    future = client.get("/api/meetings", params={"date_from": "2100-01-01T00:00:00Z"}).json()
    assert future["total"] == 0


def test_meeting_detail_and_transcript(client: TestClient) -> None:
    meeting = client.get("/api/meetings", params={"q": "Roadmap"}).json()["items"][0]
    detail = client.get(f"/api/meetings/{meeting['id']}").json()
    assert detail["summary"]["overview"]
    assert len(detail["chapters"]) >= 3
    assert detail["action_items"]
    assert abs(sum(s["talk_percent"] for s in detail["speaker_stats"]) - 100) < 1

    segments = client.get(f"/api/meetings/{meeting['id']}/transcript").json()
    assert len(segments) == detail["segment_count"]
    assert all(s["speaker"] for s in segments)
    assert any("question" in s["flags"] for s in segments)
    assert any("task" in s["flags"] for s in segments)


def test_meeting_crud_via_pasted_transcript(client: TestClient) -> None:
    created = client.post(
        "/api/meetings",
        json={"title": "Budget review", "transcript_text": TRANSCRIPT, "tags": ["Finance"], "participants": [{"name": "Nora Hale", "email": "nora@x.example"}]},
    )
    assert created.status_code == 201, created.text
    meeting = created.json()
    assert meeting["source"] == "paste"
    assert {p["name"] for p in meeting["participants"]} == {"Nora Hale", "Omar Said"}
    assert meeting["summary"]["generated_by"] == "heuristic"
    assert meeting["duration_seconds"] > 0
    texts = [a["text"] for a in meeting["action_items"]]
    assert any("breakdown" in t.lower() for t in texts), texts

    mid = meeting["id"]
    renamed = client.patch(f"/api/meetings/{mid}", json={"title": "Q1 budget review", "tags": ["Finance", "Planning"]}).json()
    assert renamed["title"] == "Q1 budget review"
    assert [t["name"] for t in renamed["tags"]] == ["Finance", "Planning"]

    # Adding a participant works; removing someone who speaks is refused.
    people = [{"name": p["name"]} for p in renamed["participants"]] + [{"name": "Guest Viewer"}]
    assert len(client.patch(f"/api/meetings/{mid}", json={"participants": people}).json()["participants"]) == 3
    blocked = client.patch(f"/api/meetings/{mid}", json={"participants": [{"name": "Nora Hale"}]})
    assert blocked.status_code == 409
    ok = client.patch(f"/api/meetings/{mid}", json={"participants": [{"name": "Nora Hale"}, {"name": "Omar Said"}]})
    assert len(ok.json()["participants"]) == 2

    assert client.delete(f"/api/meetings/{mid}").status_code == 204
    assert client.get(f"/api/meetings/{mid}").status_code == 404
    # FTS rows are removed with the meeting (triggers fire on cascade).
    assert client.get("/api/search", params={"q": "paid search breakdown"}).json()["total_meetings"] == 0


def test_manual_meeting_without_transcript(client: TestClient) -> None:
    res = client.post("/api/meetings", json={"title": "Coffee chat", "duration_seconds": 900, "participants": [{"name": "Alex Rivera"}]})
    assert res.status_code == 201
    body = res.json()
    assert body["source"] == "manual" and body["summary"] is None and body["duration_seconds"] == 900
    client.delete(f"/api/meetings/{body['id']}")


def test_upload_transcript_file(client: TestClient) -> None:
    files = {"file": ("design-sync.txt", TRANSCRIPT.encode(), "text/plain")}
    res = client.post("/api/meetings/upload", files=files, data={"tags": "Design, Sync"})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["title"] == "Design Sync"
    assert body["source"] == "upload"
    assert [t["name"] for t in body["tags"]] == ["Design", "Sync"]

    bad = client.post("/api/meetings/upload", files={"file": ("empty.txt", b"   ", "text/plain")})
    assert bad.status_code == 422
    client.delete(f"/api/meetings/{body['id']}")


def test_action_item_lifecycle(client: TestClient) -> None:
    meeting = client.get("/api/meetings", params={"q": "Retrospective"}).json()["items"][0]
    detail = client.get(f"/api/meetings/{meeting['id']}").json()
    assignee = detail["participants"][0]["person_id"]

    created = client.post(
        f"/api/meetings/{meeting['id']}/action-items", json={"text": "Book the retro room", "assignee_id": assignee, "due_date": "2030-01-15"}
    )
    assert created.status_code == 201
    item = created.json()
    assert item["source"] == "manual" and item["assignee"]["id"] == assignee

    done = client.patch(f"/api/action-items/{item['id']}", json={"is_completed": True}).json()
    assert done["is_completed"] and done["completed_at"]
    reopened = client.patch(f"/api/action-items/{item['id']}", json={"is_completed": False, "text": "Book a bigger room"}).json()
    assert not reopened["is_completed"] and reopened["completed_at"] is None and reopened["text"] == "Book a bigger room"

    outsider = client.get("/api/people", params={"q": "Rachel"}).json()[0]["id"]
    assert client.patch(f"/api/action-items/{item['id']}", json={"assignee_id": outsider}).status_code == 422

    open_items = client.get("/api/action-items", params={"completed": False}).json()
    assert any(i["id"] == item["id"] and i["meeting"]["id"] == meeting["id"] for i in open_items)

    assert client.delete(f"/api/action-items/{item['id']}").status_code == 204
    assert client.patch(f"/api/action-items/{item['id']}", json={"is_completed": True}).status_code == 404


def test_regenerate_keeps_manual_and_completed_items(client: TestClient) -> None:
    meeting = client.get("/api/meetings", params={"q": "Globex"}).json()["items"][0]
    before = client.get(f"/api/meetings/{meeting['id']}").json()
    completed = {a["id"] for a in before["action_items"] if a["is_completed"]}

    after = client.post(f"/api/meetings/{meeting['id']}/summary/regenerate").json()
    assert after["summary"]["generated_by"] == "heuristic"
    assert completed <= {a["id"] for a in after["action_items"]}


def test_search_highlights_and_escapes(client: TestClient) -> None:
    body = client.get("/api/search", params={"q": "canvas"}).json()
    assert body["total_meetings"] >= 3
    assert "<mark>" in body["results"][0]["hits"][0]["snippet"]
    # Prefix matching on the last term
    assert client.get("/api/search", params={"q": "salesfor"}).json()["total_meetings"] >= 3
    # Punctuation-only queries don't break FTS syntax
    assert client.get("/api/search", params={"q": '"*)('}).json()["results"] == []


def test_comments_soundbites_and_segment_edit(client: TestClient) -> None:
    meeting = client.get("/api/meetings", params={"q": "Standup"}).json()["items"][0]
    mid = meeting["id"]
    segment = client.get(f"/api/meetings/{mid}/transcript").json()[2]

    comment = client.post(f"/api/meetings/{mid}/comments", json={"segment_id": segment["id"], "body": "Nice"}).json()
    assert comment["start_ms"] == segment["start_ms"]
    assert any(c["id"] == comment["id"] for c in client.get(f"/api/meetings/{mid}/comments").json())
    assert client.delete(f"/api/comments/{comment['id']}").status_code == 204

    bite = client.post(f"/api/meetings/{mid}/soundbites", json={"title": "Clip", "start_ms": 1000, "end_ms": 5000})
    assert bite.status_code == 201
    assert client.post(f"/api/meetings/{mid}/soundbites", json={"title": "Bad", "start_ms": 5000, "end_ms": 1000}).status_code == 422
    assert client.delete(f"/api/soundbites/{bite.json()['id']}").status_code == 204

    edited = client.patch(f"/api/meetings/{mid}/transcript/{segment['id']}", json={"text": "Nice.  Any   blockers?"}).json()
    assert edited["text"] == "Nice. Any blockers?"
    assert "question" in edited["flags"]


def test_askfred_offline_answers(client: TestClient) -> None:
    meeting = client.get("/api/meetings", params={"q": "Acme"}).json()["items"][0]
    mid = meeting["id"]
    actions = client.post(f"/api/meetings/{mid}/chat", json={"question": "What are the action items?"}).json()
    assert actions["powered_by"] == "offline"
    assert "ROI model" in actions["answer"]["content"]

    topic = client.post(f"/api/meetings/{mid}/chat", json={"question": "What did they say about SOC 2?"}).json()
    assert "SOC 2" in topic["answer"]["content"] and "[" in topic["answer"]["content"]

    assert len(client.get(f"/api/meetings/{mid}/chat").json()) == 4
    assert client.delete(f"/api/meetings/{mid}/chat").status_code == 204
    assert client.get(f"/api/meetings/{mid}/chat").json() == []


def test_exports(client: TestClient) -> None:
    mid = client.get("/api/meetings", params={"q": "Onboarding"}).json()["items"][0]["id"]
    md = client.get(f"/api/meetings/{mid}/export", params={"format": "md"})
    assert md.status_code == 200 and md.text.startswith("# Design Review")
    assert "attachment" in md.headers["content-disposition"]
    assert "## Transcript" in md.text and "## Action items" in md.text

    summary_only = client.get(f"/api/meetings/{mid}/export", params={"format": "txt", "content": "summary"}).text
    assert "TRANSCRIPT" not in summary_only and "ACTION ITEMS" in summary_only

    srt = client.get(f"/api/meetings/{mid}/export", params={"format": "srt"}).text
    assert srt.startswith("1\n00:00:00,000 --> ")

    pdf = client.get(f"/api/meetings/{mid}/export", params={"format": "pdf"})
    assert pdf.content.startswith(b"%PDF")


def test_profile_stats_and_notifications(client: TestClient) -> None:
    me = client.patch("/api/me", json={"job_title": "VP Product"}).json()
    assert me["job_title"] == "VP Product"
    stats = client.get("/api/stats").json()
    assert stats["meetings_total"] >= 8 and stats["open_action_items"] > 0
    notes = client.get("/api/notifications").json()
    assert notes
    assert client.post("/api/notifications/read-all").status_code == 204
    assert all(n["is_read"] for n in client.get("/api/notifications").json())


def test_validation_errors(client: TestClient) -> None:
    assert client.post("/api/meetings", json={"title": ""}).status_code == 422
    assert client.get("/api/meetings/999999").status_code == 404
    assert client.get("/api/meetings", params={"sort": "sideways"}).status_code == 422
