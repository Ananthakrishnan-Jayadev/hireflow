import httpx
import json
from config import settings

class MeetStreamClient:
    """HTTP client for MeetStream Bot API."""

    def __init__(self):
        self.base_url = settings.MEETSTREAM_API_URL
        self.headers = {
            "Authorization": f"Token {settings.MEETSTREAM_API_KEY}",
            "Content-Type": "application/json"
        }

    async def create_bot(self, meeting_link: str, session_id: str, webhook_base_url: str) -> dict:
        """Create a MeetStream bot and deploy it to a meeting."""
        body = {
            "meeting_link": meeting_link,
            "bot_name": "ShyftHatch Copilot",
            "audio_required": True,
            "video_required": False,
            "live_transcription_required": {
                "webhook_url": f"{webhook_base_url}/api/meetstream/webhook"
            },
            "callback_url": f"{webhook_base_url}/api/meetstream/callback",
            "recording_config": {
                "transcript": {
                    "provider": {
                        "deepgram_streaming": {
                            "model": "nova-3",
                            "language": "en"
                        }
                    }
                },
                "retention": {"type": "timed", "hours": 1}
            },
            "automatic_leave": {
                "waiting_room_timeout": 600,
                "everyone_left_timeout": 600,
                "in_call_recording_timeout": 14400
            },
            "custom_attributes": {
                "session_id": session_id
            }
        }
        async with httpx.AsyncClient() as client:
            print(f"Request body: {json.dumps(body)}")
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/bots/create_bot",
                    headers=self.headers,
                    json=body,
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                print(f"MeetStream API error: {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                print(f"MeetStream connection error: {e}")
                raise

    async def remove_bot(self, bot_id: str) -> dict:
        """Remove a bot from a meeting."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/bots/{bot_id}/remove",
                headers=self.headers,
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()

    async def get_bot_status(self, bot_id: str) -> dict:
        """Get current bot status."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/bots/{bot_id}/status",
                headers=self.headers,
                timeout=15.0
            )
            response.raise_for_status()
            return response.json()
