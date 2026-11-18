"""Response shape for the photo-based style suggestion endpoint."""

from pydantic import BaseModel, Field


class ThemeScore(BaseModel):
    theme: str
    score: float = Field(ge=0, le=1, description="CLIP zero-shot probability across the six themes")


class StyleSuggestion(BaseModel):
    themes: list[ThemeScore]  # best match first
    palette: list[str]  # dominant colours across the photos, as #rrggbb, most common first
    wall: str  # dominant colour of the upper part of the frame
    floor: str  # dominant colour of the bottom of the frame
