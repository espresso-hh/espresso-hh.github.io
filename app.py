from __future__ import annotations

import os
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, create_engine, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATABASE_URL = f"sqlite:///{(BASE_DIR / 'data' / 'espresso.db').as_posix()}"
RATING_GROUPS = (("Taste", 3, 4), ("Texture and finish", 2, 4), ("Experience", 1, 5))
RATING_WEIGHTS = {
    f"{group_index}-{item_index}": weight
    for group_index, (_, weight, item_count) in enumerate(RATING_GROUPS)
    for item_index in range(item_count)
}


class Base(DeclarativeBase):
    pass


class Cafe(Base):
    __tablename__ = "cafes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160, collation="NOCASE"), unique=True)
    tastings: Mapped[list[Tasting]] = relationship(
        back_populates="cafe",
        cascade="all, delete-orphan",
    )


class Tasting(Base):
    __tablename__ = "tastings"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_key: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True)
    cafe_id: Mapped[int] = mapped_column(ForeignKey("cafes.id"), index=True)
    tasted_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    double_price: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    single_price: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    note: Mapped[str] = mapped_column(String(5000), default="", nullable=False)
    score: Mapped[int] = mapped_column(Integer)

    cafe: Mapped[Cafe] = relationship(back_populates="tastings")
    ratings: Mapped[list[Rating]] = relationship(
        back_populates="tasting",
        cascade="all, delete-orphan",
    )


class Rating(Base):
    __tablename__ = "ratings"

    tasting_id: Mapped[int] = mapped_column(
        ForeignKey("tastings.id", ondelete="CASCADE"),
        primary_key=True,
    )
    criterion: Mapped[str] = mapped_column(String(8), primary_key=True)
    value: Mapped[int] = mapped_column(Integer)

    tasting: Mapped[Tasting] = relationship(back_populates="ratings")


def parse_price(value: Any, field: str) -> Decimal | None:
    if value is None or value == "":
        return None

    try:
        price = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f"{field} must be a valid non-negative price.") from None

    if not price.is_finite() or price < 0 or price > Decimal("999999.99"):
        raise ValueError(f"{field} must be between 0 and 999999.99.")

    return price.quantize(Decimal("0.01"))


def parse_tasting(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("A JSON object is required.")

    cafe_name = data.get("cafe")
    if not isinstance(cafe_name, str) or not cafe_name.strip():
        raise ValueError("cafe is required.")
    cafe_name = cafe_name.strip()
    if len(cafe_name) > 160:
        raise ValueError("cafe must be 160 characters or fewer.")

    client_key = data.get("client_key")
    if client_key is not None and (
        not isinstance(client_key, str) or not client_key or len(client_key) > 80
    ):
        raise ValueError("client_key must be a non-empty string of 80 characters or fewer.")

    raw_date = data.get("date") or None
    try:
        tasted_on = date.fromisoformat(raw_date) if raw_date else None
    except (TypeError, ValueError):
        raise ValueError("date must use YYYY-MM-DD format.") from None

    note = data.get("note", "")
    if not isinstance(note, str) or len(note) > 5000:
        raise ValueError("note must be 5000 characters or fewer.")

    ratings = data.get("ratings", {})
    if not isinstance(ratings, dict):
        raise ValueError("ratings must be an object.")

    parsed_ratings: dict[str, int] = {}
    for criterion, value in ratings.items():
        if criterion not in RATING_WEIGHTS:
            raise ValueError(f"Unknown rating criterion: {criterion}.")
        if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 5:
            raise ValueError(f"Rating {criterion} must be an integer from 0 to 5.")
        parsed_ratings[criterion] = value

    weighted_score = sum(
        value * RATING_WEIGHTS[criterion]
        for criterion, value in parsed_ratings.items()
    )
    maximum_score = sum(5 * weight * count for _, weight, count in RATING_GROUPS)

    return {
        "cafe_name": cafe_name,
        "client_key": client_key,
        "tasted_on": tasted_on,
        "double_price": parse_price(data.get("double_price"), "double_price"),
        "single_price": parse_price(data.get("single_price"), "single_price"),
        "note": note.strip(),
        "score": round(weighted_score / maximum_score * 100),
        "ratings": parsed_ratings,
    }


def serialize_tasting(tasting: Tasting) -> dict[str, Any]:
    return {
        "id": tasting.id,
        "cafe": tasting.cafe.name,
        "date": tasting.tasted_on.isoformat() if tasting.tasted_on else "",
        "double_price": (
            float(tasting.double_price) if tasting.double_price is not None else ""
        ),
        "single_price": (
            float(tasting.single_price) if tasting.single_price is not None else ""
        ),
        "note": tasting.note,
        "score": tasting.score,
        "ratings": {rating.criterion: rating.value for rating in tasting.ratings},
    }


def create_app(database_url: str | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    url = database_url or os.environ.get("ESPRESSO_DATABASE_URL", DEFAULT_DATABASE_URL)

    if url.startswith("sqlite:///") and ":memory:" not in url:
        database_path = Path(url.removeprefix("sqlite:///"))
        database_path.parent.mkdir(parents=True, exist_ok=True)

    engine_options: dict[str, Any] = {"future": True}
    if url.startswith("sqlite:"):
        engine_options["connect_args"] = {"check_same_thread": False}

    engine = create_engine(url, **engine_options)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    app.extensions["espresso_engine"] = engine
    app.extensions["espresso_session_factory"] = session_factory

    @app.get("/")
    def index():
        return send_from_directory(BASE_DIR, "index.html")

    @app.get("/assets/<path:filename>")
    def assets(filename: str):
        return send_from_directory(BASE_DIR / "assets", filename)

    @app.get("/api/tastings")
    def list_tastings():
        with session_factory() as session:
            tastings = session.scalars(
                select(Tasting).order_by(Tasting.score.desc(), Tasting.id.desc())
            ).all()
            return jsonify([serialize_tasting(tasting) for tasting in tastings])

    @app.post("/api/tastings")
    def create_tasting():
        try:
            tasting_data = parse_tasting(request.get_json(silent=True))
        except ValueError as error:
            return jsonify(error=str(error)), 400

        try:
            with session_factory.begin() as session:
                if tasting_data["client_key"]:
                    existing = session.scalar(
                        select(Tasting).where(
                            Tasting.client_key == tasting_data["client_key"]
                        )
                    )
                    if existing is not None:
                        return jsonify(serialize_tasting(existing)), 200

                cafe = session.scalar(
                    select(Cafe).where(Cafe.name == tasting_data["cafe_name"])
                )
                if cafe is None:
                    cafe = Cafe(name=tasting_data["cafe_name"])
                    session.add(cafe)
                    session.flush()

                tasting = Tasting(
                    client_key=tasting_data["client_key"],
                    cafe=cafe,
                    tasted_on=tasting_data["tasted_on"],
                    double_price=tasting_data["double_price"],
                    single_price=tasting_data["single_price"],
                    note=tasting_data["note"],
                    score=tasting_data["score"],
                    ratings=[
                        Rating(criterion=criterion, value=value)
                        for criterion, value in tasting_data["ratings"].items()
                    ],
                )
                session.add(tasting)
                session.flush()
                response_data = serialize_tasting(tasting)
        except IntegrityError:
            return jsonify(error="This tasting conflicts with an existing record; retry the save."), 409
        except SQLAlchemyError:
            app.logger.exception("Could not save espresso tasting.")
            return jsonify(error="The database could not save this tasting."), 500

        return jsonify(response_data), 201

    @app.delete("/api/tastings/<int:tasting_id>")
    def delete_tasting(tasting_id: int):
        try:
            with session_factory.begin() as session:
                tasting = session.get(Tasting, tasting_id)
                if tasting is None:
                    return jsonify(error="Tasting not found."), 404

                cafe = tasting.cafe
                session.delete(tasting)
                remaining = session.scalar(
                    select(func.count()).select_from(Tasting).where(
                        Tasting.cafe_id == cafe.id
                    )
                )
                if remaining == 0:
                    session.delete(cafe)
        except SQLAlchemyError:
            app.logger.exception("Could not delete espresso tasting.")
            return jsonify(error="The database could not delete this tasting."), 500

        return "", 204

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
