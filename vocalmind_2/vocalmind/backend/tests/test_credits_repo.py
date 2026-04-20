"""credits 리포지토리 단위 테스트 — Supabase RPC mock (infra.supabase.gateway)."""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import httpx
import pytest

from domain_types.credits import (
    CreditsError,
    InsufficientCreditsError,
    LedgerEntry,
)
from infra.supabase import credits_repo as credits


@pytest.fixture(autouse=True)
def _env():
    with patch.dict(os.environ, {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test-key",
    }):
        yield


def _mock_response(status_code: int, body):
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = body
    resp.text = str(body)
    return resp


class TestConsume:
    def test_valid_consume_returns_ledger_id(self):
        with patch("infra.supabase.gateway.httpx.post") as mock_post:
            mock_post.return_value = _mock_response(200, 12345)
            entry = credits.consume("user-1", 5, "cover_consume", job_id="job-1")
        assert entry.ledger_id == 12345
        call = mock_post.call_args
        assert "consume_credits" in call.args[0]
        assert call.kwargs["json"] == {
            "p_user_id": "user-1",
            "p_amount": 5,
            "p_reason": "cover_consume",
            "p_job_id": "job-1",
        }

    def test_zero_amount_raises(self):
        with pytest.raises(CreditsError) as exc:
            credits.consume("user-1", 0, "cover_consume")
        assert exc.value.code == "INVALID_AMOUNT"

    def test_negative_amount_raises(self):
        with pytest.raises(CreditsError):
            credits.consume("user-1", -3, "cover_consume")

    def test_insufficient_credits_parsed(self):
        with patch("infra.supabase.gateway.httpx.post") as mock_post:
            mock_post.return_value = _mock_response(
                400, {"message": "INSUFFICIENT_CREDITS: balance=3 need=5"},
            )
            mock_post.return_value.text = "INSUFFICIENT_CREDITS: balance=3 need=5"
            with pytest.raises(InsufficientCreditsError) as exc:
                credits.consume("user-1", 5, "cover_consume")
            assert exc.value.balance == 3
            assert exc.value.needed == 5
            assert exc.value.code == "INSUFFICIENT_CREDITS"

    def test_network_error_wrapped(self):
        with patch("infra.supabase.gateway.httpx.post") as mock_post:
            mock_post.side_effect = httpx.ConnectError("DNS fail")
            with pytest.raises(CreditsError) as exc:
                credits.consume("user-1", 5, "cover_consume")
            assert exc.value.code == "NETWORK_ERROR"


class TestGrant:
    def test_topup_records_payment_id(self):
        with patch("infra.supabase.gateway.httpx.post") as mock_post:
            mock_post.return_value = _mock_response(200, 999)
            entry = credits.grant(
                "user-2", 50, "topup_purchase",
                payment_id="pay-abc",
                metadata={"pack": 50},
            )
        assert entry.ledger_id == 999
        sent = mock_post.call_args.kwargs["json"]
        assert sent["p_amount"] == 50
        assert sent["p_reason"] == "topup_purchase"
        assert sent["p_payment_id"] == "pay-abc"
        assert sent["p_metadata"] == {"pack": 50}

    def test_refund_job_delegates_to_grant(self):
        with patch("infra.supabase.credits_repo.grant") as mock_grant:
            mock_grant.return_value = LedgerEntry(ledger_id=77)
            entry = credits.refund_job("user-3", "job-3", 5)
        assert entry.ledger_id == 77
        mock_grant.assert_called_once_with(
            user_id="user-3",
            amount=5,
            reason="job_refund",
            job_id="job-3",
            metadata={"auto_refund": True},
        )

    def test_grant_zero_raises(self):
        with pytest.raises(CreditsError) as exc:
            credits.grant("user-1", 0, "signup_bonus")
        assert exc.value.code == "INVALID_AMOUNT"


class TestConfigGuards:
    def test_missing_env_raises(self):
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(CreditsError) as exc:
                credits.consume("user-1", 1, "cover_consume")
            assert exc.value.code == "CONFIG_ERROR"
