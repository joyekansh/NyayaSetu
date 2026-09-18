from pydantic import BaseModel, ConfigDict, Field


class NormalizedField(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str = Field(min_length=1, max_length=128)
    value: str | int
    confidence: float = Field(ge=0.0, le=1.0, allow_inf_nan=False)


class ParsedDocument(BaseModel):
    model_config = ConfigDict(frozen=True)

    document_type: str = Field(min_length=1)
    fields: tuple[NormalizedField, ...] = ()

