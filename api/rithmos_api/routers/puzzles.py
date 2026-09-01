"""Daily Middles puzzles. Generated and verified by jobs/; the server only stores,
serves without the solution, compares a submitted move, and reports the distribution."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from ..auth import Account, current_account, require_jobs_token

router = APIRouter(prefix="/v1", tags=["puzzles"])


class PuzzlePiece(BaseModel):
    id: str
    side: Literal["white", "black"]
    shape: Literal["round", "triangle", "square"]
    value: int = Field(ge=1)
    square: str = Field(pattern=r"^[a-h](1[0-6]|[1-9])$")


class Solution(BaseModel):
    pieceId: str
    from_: str = Field(alias="from", pattern=r"^[a-h](1[0-6]|[1-9])$")
    to: str = Field(pattern=r"^[a-h](1[0-6]|[1-9])$")

    model_config = {"populate_by_name": True}


class HarmonyInfo(BaseModel):
    kinds: list[Literal["arithmetic", "geometric", "musical"]]
    values: list[int]


class PuzzleIn(BaseModel):
    """What jobs/ produces (jobs/src/middles.ts, MiddlesPuzzle)."""

    date: date
    seed: int
    side: Literal["white", "black"]
    pieces: list[PuzzlePiece] = Field(min_length=3)
    goal: dict[str, Any]
    solution: Solution
    harmony: HarmonyInfo
    difficulty: int = Field(ge=1, le=3)


class PuzzleBatch(BaseModel):
    puzzles: list[PuzzleIn] = Field(min_length=1, max_length=400)


class PuzzleOut(BaseModel):
    date: date
    side: Literal["white", "black"]
    difficulty: int
    pieces: list[PuzzlePiece]
    goal: dict[str, Any]
    attempted: bool = False


class Move(BaseModel):
    pieceId: str
    from_: str = Field(alias="from")
    to: str

    model_config = {"populate_by_name": True}


class AttemptIn(BaseModel):
    move: Move
    tries: int = Field(ge=1, le=99)
    seconds: int = Field(ge=0, le=86_400)


class Distribution(BaseModel):
    attempts: int
    solved: int
    tries: dict[int, int]


class AttemptOut(BaseModel):
    solved: bool
    solution: Solution
    harmony: HarmonyInfo
    distribution: Distribution


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _load(conn, day: date) -> dict | None:
    return conn.execute(
        "SELECT date, side, difficulty, payload, solution FROM puzzles WHERE date = %s", (day,)
    ).fetchone()


def _distribution(conn, day: date) -> Distribution:
    rows = conn.execute(
        "SELECT solved, tries, count(*) AS n FROM attempts WHERE puzzle_date = %s GROUP BY solved, tries",
        (day,),
    ).fetchall()
    attempts = sum(int(r["n"]) for r in rows)
    solved = sum(int(r["n"]) for r in rows if r["solved"])
    tries = {int(r["tries"]): int(r["n"]) for r in rows if r["solved"]}
    return Distribution(attempts=attempts, solved=solved, tries=dict(sorted(tries.items())))


def _puzzle_out(row: dict, attempted: bool) -> PuzzleOut:
    payload = row["payload"]
    return PuzzleOut(
        date=row["date"],
        side=row["side"],
        difficulty=int(row["difficulty"]),
        pieces=payload["pieces"],
        goal=payload["goal"],
        attempted=attempted,
    )


@router.post("/admin/puzzles", dependencies=[Depends(require_jobs_token)])
def upsert_puzzles(body: PuzzleBatch, request: Request) -> dict:
    """Ingest from the nightly job. Replaces a puzzle for a date that has no attempts yet."""
    stored = skipped = 0
    with request.app.state.pool.connection() as conn:
        for p in body.puzzles:
            has_attempts = conn.execute("SELECT 1 FROM attempts WHERE puzzle_date = %s LIMIT 1", (p.date,)).fetchone()
            if has_attempts:
                skipped += 1
                continue
            payload = {"pieces": [x.model_dump() for x in p.pieces], "goal": p.goal, "seed": p.seed}
            solution = {"move": p.solution.model_dump(by_alias=True), "harmony": p.harmony.model_dump()}
            conn.execute(
                "INSERT INTO puzzles (date, side, difficulty, payload, solution) VALUES (%s, %s, %s, %s, %s) "
                "ON CONFLICT (date) DO UPDATE SET side = EXCLUDED.side, difficulty = EXCLUDED.difficulty, "
                "payload = EXCLUDED.payload, solution = EXCLUDED.solution",
                (p.date, p.side, p.difficulty, Jsonb(payload), Jsonb(solution)),
            )
            stored += 1
        conn.commit()
    return {"stored": stored, "skipped": skipped}


def _attempted(conn, day: date, request: Request) -> bool:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return False
    from ..auth import token_hash

    row = conn.execute(
        "SELECT 1 FROM attempts a JOIN accounts acc ON acc.id = a.account_id "
        "WHERE a.puzzle_date = %s AND acc.token_hash = %s",
        (day, token_hash(auth[7:])),
    ).fetchone()
    return row is not None


@router.get("/puzzles/today", response_model=PuzzleOut)
def today(request: Request) -> PuzzleOut:
    return by_date(_today(), request)


@router.get("/puzzles/{day}", response_model=PuzzleOut)
def by_date(day: date, request: Request) -> PuzzleOut:
    """The puzzle without its solution. Future dates are not served."""
    if day > _today():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no puzzle for that date")
    with request.app.state.pool.connection() as conn:
        row = _load(conn, day)
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "no puzzle for that date")
        return _puzzle_out(row, _attempted(conn, day, request))


@router.get("/puzzles/{day}/distribution", response_model=Distribution)
def distribution(day: date, request: Request) -> Distribution:
    with request.app.state.pool.connection() as conn:
        if _load(conn, day) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "no puzzle for that date")
        return _distribution(conn, day)


@router.post("/puzzles/{day}/attempts", response_model=AttemptOut)
def attempt(day: date, body: AttemptIn, request: Request, account: Account = Depends(current_account)) -> AttemptOut:
    """Record the one attempt of an account. The move is compared with the stored solution;
    the solution and the harmony come back either way, together with the distribution."""
    if day > _today():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no puzzle for that date")
    with request.app.state.pool.connection() as conn:
        row = _load(conn, day)
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "no puzzle for that date")
        stored = row["solution"]
        sol = stored["move"]
        solved = body.move.pieceId == sol["pieceId"] and body.move.from_ == sol["from"] and body.move.to == sol["to"]
        cur = conn.execute(
            "INSERT INTO attempts (account_id, puzzle_date, tries, seconds, solved) VALUES (%s, %s, %s, %s, %s) "
            "ON CONFLICT (account_id, puzzle_date) DO NOTHING",
            (account.id, day, body.tries, body.seconds, solved),
        )
        if cur.rowcount == 0:
            conn.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "already attempted")
        conn.commit()
        dist = _distribution(conn, day)
    return AttemptOut(
        solved=solved,
        solution=Solution.model_validate(sol),
        harmony=HarmonyInfo.model_validate(stored["harmony"]),
        distribution=dist,
    )
