from pydantic import BaseModel, ConfigDict, Field, model_validator


class SchemeClauseFixture(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    clause_id: str = Field(min_length=1, max_length=128)
    act_name: str = Field(min_length=1, max_length=255)
    section: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1)
    eligibility_criteria: dict[str, object] = Field(default_factory=dict)
    active: bool = True

    @property
    def citation(self) -> str:
        return f"{self.act_name}, Section {self.section}"


class SchemeFixture(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    scheme_id: str = Field(min_length=1, max_length=128)
    scheme_name: str = Field(min_length=1, max_length=255)
    jurisdiction: str = Field(min_length=2, max_length=64)
    version: str = Field(min_length=1, max_length=64)
    clauses: tuple[SchemeClauseFixture, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def clause_ids_are_unique(self) -> "SchemeFixture":
        ids = [clause.clause_id for clause in self.clauses]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate clause_id in scheme fixture")
        return self

