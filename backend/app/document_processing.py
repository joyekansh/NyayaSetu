from enum import StrEnum


class ProcessingState(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    FAILED = "FAILED"


class ErrorDisposition(StrEnum):
    RETRYABLE = "RETRYABLE"
    TERMINAL = "TERMINAL"


class InvalidProcessingTransition(ValueError):
    pass


ALLOWED_TRANSITIONS = {
    ProcessingState.PENDING: {ProcessingState.PROCESSING},
    ProcessingState.PROCESSING: {ProcessingState.DONE, ProcessingState.FAILED},
    ProcessingState.DONE: {ProcessingState.DONE},
    ProcessingState.FAILED: {ProcessingState.FAILED},
}


def transition_processing_state(current: ProcessingState, next_state: ProcessingState) -> ProcessingState:
    if next_state not in ALLOWED_TRANSITIONS[current]:
        raise InvalidProcessingTransition(f"cannot transition {current} to {next_state}")
    return next_state


def classify_processing_error(error: Exception) -> ErrorDisposition:
    if isinstance(error, (TimeoutError, ConnectionError, OSError)):
        return ErrorDisposition.RETRYABLE
    return ErrorDisposition.TERMINAL

