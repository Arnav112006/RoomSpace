from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.services import command_matching

router = APIRouter(prefix="/api/commands", tags=["Commands"])


class InterpretRequest(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    # Canonical commands the rule parser understands, built by the client
    # for the current room (it knows the layout's labels).
    candidates: list[str] = Field(min_length=1, max_length=400)


class CommandMatch(BaseModel):
    candidate: str
    score: float  # cosine similarity, -1..1


class InterpretResponse(BaseModel):
    matches: list[CommandMatch]  # best first


@router.post("/interpret", response_model=InterpretResponse)
async def interpret_command(request: InterpretRequest):
    """Closest known commands to a phrasing the rules didn't understand,
    by meaning (local sentence-embedding model). The client decides
    whether a match is close enough and re-parses it with the rules."""
    candidates = [c for c in request.candidates if 0 < len(c) <= 120]
    if not candidates:
        raise HTTPException(status_code=422, detail="No usable candidate commands")
    try:
        ranked = await run_in_threadpool(command_matching.rank, request.text, candidates)
    except command_matching.MLUnavailable as e:
        raise HTTPException(
            status_code=503,
            detail="Understanding free-form commands needs the ML extras: pip install -r requirements-ml.txt",
        ) from e
    return InterpretResponse(matches=[CommandMatch(candidate=c, score=s) for c, s in ranked])
