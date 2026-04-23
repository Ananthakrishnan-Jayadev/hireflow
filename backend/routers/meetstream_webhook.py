from fastapi import APIRouter, Request, Response
from services.realtime.schemas import MeetStreamWebhookPayload
from services.realtime.source_adapters.meetstream_adapter import get_meetstream_adapter

router = APIRouter(prefix="/api/meetstream", tags=["meetstream"])

@router.post("/webhook")
async def meetstream_transcript_webhook(payload: MeetStreamWebhookPayload):
    """
    Receives live transcript chunks from MeetStream.
    Routes them through the MeetStreamAdapter into the copilot pipeline.
    """
    print(f"[WEBHOOK] Received: bot_id={payload.bot_id}, is_final={payload.is_final}, end_of_turn={payload.end_of_turn}, transcript='{payload.transcript}', session_id={payload.custom_attributes.get('session_id')}")
    # Get the adapter instance
    adapter = get_meetstream_adapter()
    session_id = await adapter.ingest(payload)

    # Always return 200 quickly
    return {"status": "ok", "session_id": session_id}


@router.post("/callback")
async def meetstream_status_callback(request: Request):
    """
    Receives bot status changes from MeetStream.
    Events: joining, in_meeting, exiting, audio_processed, etc.
    """
    body = await request.json()
    bot_id = body.get("bot_id")
    status = body.get("status")

    if status in ("exiting", "done", "error") and bot_id:
        adapter = get_meetstream_adapter()
        adapter.unregister_bot_session(bot_id)

    return {"status": "ok"}
