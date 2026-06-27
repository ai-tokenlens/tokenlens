"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("display_name", sa.String, nullable=True),
        sa.Column("github_login", sa.String, nullable=True),
        sa.Column("team", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "skills",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("summary", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("usage", sa.Text, nullable=True),
        sa.Column("tags", sa.Text, nullable=True),
        sa.Column("author", sa.String, nullable=True),
        sa.Column("origin", sa.String, nullable=False),
        sa.Column("origin_url", sa.String, nullable=True),
        sa.Column("latest_version", sa.String, nullable=False, server_default="1.0.0"),
        sa.Column("avg_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("use_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rating_avg", sa.Float, nullable=False, server_default="0"),
        sa.Column("rating_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "skill_versions",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("skill_id", sa.String, sa.ForeignKey("skills.id"), nullable=False),
        sa.Column("version", sa.String, nullable=False),
        sa.Column("manifest_toml", sa.Text, nullable=False),
        sa.Column("payload_uri", sa.String, nullable=False),
        sa.Column("checksum", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("skill_id", "version", name="uq_skill_version"),
    )

    op.create_table(
        "skill_ratings",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("skill_id", sa.String, sa.ForeignKey("skills.id"), nullable=False),
        sa.Column("user_id", sa.String, nullable=False),
        sa.Column("stars", sa.Integer, nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("skill_id", "user_id", name="uq_rating_skill_user"),
        sa.CheckConstraint("stars BETWEEN 1 AND 5", name="ck_stars_range"),
    )

    op.create_table(
        "usage_events",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("user_id", sa.String, nullable=False),
        sa.Column("tool", sa.String, nullable=False),
        sa.Column("model", sa.String, nullable=True),
        sa.Column("input_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cache_read_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cache_write_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("skill_id", sa.String, nullable=True),
        sa.Column("source", sa.String, nullable=False),
        sa.Column("context", sa.Text, nullable=True),
        sa.Column("trace_id", sa.String, nullable=True),
        sa.Column("timestamp", sa.DateTime, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_index("idx_events_user_ts", "usage_events", ["user_id", "timestamp"])
    op.create_index("idx_events_tool_ts", "usage_events", ["tool", "timestamp"])


def downgrade() -> None:
    op.drop_index("idx_events_tool_ts", table_name="usage_events")
    op.drop_index("idx_events_user_ts", table_name="usage_events")
    op.drop_table("usage_events")
    op.drop_table("skill_ratings")
    op.drop_table("skill_versions")
    op.drop_table("skills")
    op.drop_table("users")
