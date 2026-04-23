from typing import Optional

from config import settings
from services.realtime.source_adapters.base_adapter import TranscriptSourceAdapter
from services.realtime.source_adapters.local_simulator import LocalSimulatorAdapter
from services.realtime.source_adapters.meetstream_adapter import get_meetstream_adapter


def create_transcript_adapter(
    source: Optional[str] = None,
    **kwargs: dict,
) -> TranscriptSourceAdapter:
    """Create a transcript source adapter based on configuration.

    Args:
        source: Override source type ("local" or "meetstream").
                If None, uses COPILOT_TRANSCRIPT_SOURCE from config.
        **kwargs: Additional arguments passed to adapter constructor.

    Returns:
        Configured TranscriptSourceAdapter instance.

    Raises:
        ValueError: If source type is not supported.
    """
    source_type = (source or settings.COPILOT_TRANSCRIPT_SOURCE or "local").strip().lower()

    if source_type == "local":
        return LocalSimulatorAdapter(chunks=kwargs.get("chunks", []))
    elif source_type == "meetstream":
        adapter = get_meetstream_adapter()
        # Ensure threshold is updated if changed in settings
        adapter.confidence_threshold = getattr(settings, "MEETSTREAM_CONFIDENCE_THRESHOLD", 0.3)
        return adapter
    else:
        raise ValueError(
            f"Unsupported transcript source: {source_type}. "
            "Use 'local' or 'meetstream'."
        )


__all__ = ["create_transcript_adapter"]