import pytest


def test_celery_uses_redis_url_from_settings() -> None:
    from app.celery_app import create_celery_app
    from app.config import Settings

    celery = create_celery_app(Settings(redis_url="redis://queue.example.test:6380/7"))

    assert celery.conf.broker_url == "redis://queue.example.test:6380/7"
    assert celery.conf.result_backend == "redis://queue.example.test:6380/7"


def test_pending_document_can_start_processing() -> None:
    from app.document_processing import ProcessingState, transition_processing_state

    assert transition_processing_state(ProcessingState.PENDING, ProcessingState.PROCESSING) is ProcessingState.PROCESSING


@pytest.mark.parametrize("terminal_state", ["DONE", "FAILED"])
def test_processing_document_can_reach_terminal_state(terminal_state: str) -> None:
    from app.document_processing import ProcessingState, transition_processing_state

    assert transition_processing_state(ProcessingState.PROCESSING, ProcessingState(terminal_state)) is ProcessingState(terminal_state)


@pytest.mark.parametrize("terminal_state", ["DONE", "FAILED"])
def test_repeating_terminal_state_is_idempotent(terminal_state: str) -> None:
    from app.document_processing import ProcessingState, transition_processing_state

    state = ProcessingState(terminal_state)
    assert transition_processing_state(state, state) is state


@pytest.mark.parametrize(("current_state", "next_state"), [("PENDING", "DONE"), ("PROCESSING", "PENDING"), ("DONE", "PROCESSING"), ("FAILED", "PROCESSING"), ("DONE", "FAILED")])
def test_lifecycle_rejects_skipped_and_backward_transitions(current_state: str, next_state: str) -> None:
    from app.document_processing import InvalidProcessingTransition, ProcessingState, transition_processing_state

    with pytest.raises(InvalidProcessingTransition):
        transition_processing_state(ProcessingState(current_state), ProcessingState(next_state))


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (TimeoutError("timed out"), "RETRYABLE"),
        (ConnectionError("unavailable"), "RETRYABLE"),
        (OSError("temporary I/O failure"), "RETRYABLE"),
        (ValueError("unsupported file"), "TERMINAL"),
        (RuntimeError("malformed document"), "TERMINAL"),
    ],
)
def test_error_disposition_distinguishes_retryable_from_terminal(error: Exception, expected: str) -> None:
    from app.document_processing import ErrorDisposition, classify_processing_error

    assert classify_processing_error(error) is ErrorDisposition(expected)

