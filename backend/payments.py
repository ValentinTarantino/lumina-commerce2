import base64
import hashlib
import hmac
import json
import os
import re
import time
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/internal/payments", tags=["payments"])
quote_cache: dict[str, Any] = {}


def require_internal_token(authorization: str | None) -> None:
    configured = os.getenv("PAYMENTS_INTERNAL_TOKEN", "")
    provided = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not configured or not provided or not hmac.compare_digest(configured, provided):
        raise HTTPException(status_code=401, detail="Unauthorized")


def require_test_credential(name: str, prefix: str) -> str:
    value = os.getenv(name, "")
    if not value.startswith(prefix) or "replace_me" in value.lower():
        raise HTTPException(status_code=503, detail=f"{name} is not configured with test credentials")
    return value


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def official_usd_sale_rate() -> tuple[Decimal, str]:
    now = time.monotonic()
    cached_at = quote_cache.get("cached_at")
    cached_rate = quote_cache.get("rate")
    cached_updated_at = quote_cache.get("updated_at")
    if (
        isinstance(cached_at, float)
        and isinstance(cached_rate, Decimal)
        and isinstance(cached_updated_at, str)
        and now - cached_at < 60
    ):
        return cached_rate, cached_updated_at

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get("https://dolarapi.com/v1/dolares/oficial")
            response.raise_for_status()
            payload = response.json()
        if payload.get("moneda") != "USD" or payload.get("casa") != "oficial":
            raise ValueError("Unexpected official USD quote")
        rate = Decimal(str(payload["venta"]))
        updated_at = payload["fechaActualizacion"]
        if rate <= 0 or not isinstance(updated_at, str):
            raise ValueError("Invalid official USD quote")
    except (httpx.HTTPError, ValueError, KeyError, InvalidOperation, TypeError) as error:
        raise HTTPException(status_code=502, detail="Could not retrieve the official USD/ARS sale rate") from error

    quote_cache.update(cached_at=now, rate=rate, updated_at=updated_at)
    return rate, updated_at


def sign_quote(reference: str, total_usd: Decimal, total_ars: Decimal, rate: Decimal, updated_at: str) -> str:
    secret = os.getenv("PAYMENTS_INTERNAL_TOKEN", "")
    if not secret:
        raise HTTPException(status_code=503, detail="Payment service is not configured")
    claims = {
        "reference": reference,
        "total_usd": str(money(total_usd)),
        "total_ars": str(money(total_ars)),
        "rate": str(rate),
        "updated_at": updated_at,
        "expires_at": int(time.time()) + 600,
    }
    encoded = base64.urlsafe_b64encode(json.dumps(claims, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def verify_quote(
    quote_id: str,
    reference: str,
    total_usd: Decimal,
    *,
    require_unexpired: bool = True,
) -> dict[str, Any]:
    secret = os.getenv("PAYMENTS_INTERNAL_TOKEN", "")
    try:
        encoded, signature = quote_id.split(".", 1)
        expected = hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not secret or not hmac.compare_digest(expected, signature):
            raise ValueError("Invalid signature")
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if (
            payload["reference"] != reference
            or Decimal(payload["total_usd"]) != money(total_usd)
            or (require_unexpired and int(payload["expires_at"]) < int(time.time()))
        ):
            raise ValueError("Expired or mismatched quote")
        return payload
    except (ValueError, KeyError, TypeError, InvalidOperation, json.JSONDecodeError) as error:
        raise HTTPException(status_code=400, detail="The payment quote is invalid or expired") from error


class QuoteRequest(BaseModel):
    reference: str = Field(min_length=8, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")
    total_usd: Decimal = Field(gt=0, le=Decimal("10000000"))


class StripeIntentRequest(BaseModel):
    reference: str = Field(min_length=8, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")
    total_usd: Decimal = Field(gt=0, le=Decimal("10000000"))
    email: str = Field(min_length=3, max_length=254)


class StripeVerifyRequest(BaseModel):
    reference: str = Field(min_length=8, max_length=100)
    payment_intent_id: str = Field(min_length=8, max_length=100)
    total_usd: Decimal = Field(gt=0, le=Decimal("10000000"))


class MercadoPagoChargeRequest(BaseModel):
    reference: str = Field(min_length=8, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")
    quote_id: str = Field(min_length=20, max_length=2000)
    token: str = Field(min_length=8, max_length=500)
    payment_method_id: str = Field(min_length=1, max_length=80)
    installments: int = Field(ge=1, le=36)
    payer_email: str = Field(min_length=3, max_length=254)
    identification_type: str = Field(min_length=1, max_length=30)
    identification_number: str = Field(min_length=3, max_length=30)
    cardholder_name: str = Field(min_length=2, max_length=100)
    issuer_id: str | None = Field(default=None, max_length=40)
    total_usd: Decimal = Field(gt=0, le=Decimal("10000000"))


class MercadoPagoVerifyRequest(BaseModel):
    reference: str = Field(min_length=8, max_length=100)
    payment_id: str = Field(min_length=1, max_length=100)
    quote_id: str = Field(min_length=20, max_length=2000)
    total_usd: Decimal = Field(gt=0, le=Decimal("10000000"))


async def stripe_request(method: str, path: str, secret: str, **kwargs: Any) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.request(
                method,
                f"https://api.stripe.com/v1/{path}",
                auth=(secret, ""),
                **kwargs,
            )
        payload = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(status_code=502, detail="Stripe could not be reached") from error

    if response.is_error:
        raise HTTPException(status_code=502, detail="Stripe rejected the payment request")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Stripe returned an invalid response")
    return payload


@router.get("/config")
async def payment_config(authorization: str | None = Header(default=None)):
    require_internal_token(authorization)
    stripe_ready = (
        os.getenv("STRIPE_SECRET_KEY", "").startswith("sk_test_")
        and os.getenv("STRIPE_PUBLISHABLE_KEY", "").startswith("pk_test_")
    )
    mercado_pago_ready = (
        os.getenv("MERCADOPAGO_ACCESS_TOKEN", "").startswith("TEST-")
        and os.getenv("MERCADOPAGO_PUBLIC_KEY", "").startswith("TEST-")
    )
    return {
        "stripe": {
            "enabled": stripe_ready,
            "publishableKey": os.getenv("STRIPE_PUBLISHABLE_KEY", "") if stripe_ready else None,
        },
        "mercadoPago": {
            "enabled": mercado_pago_ready,
            "publicKey": os.getenv("MERCADOPAGO_PUBLIC_KEY", "") if mercado_pago_ready else None,
        },
    }


@router.post("/quote")
async def create_quote(
    payload: QuoteRequest,
    authorization: str | None = Header(default=None),
):
    require_internal_token(authorization)
    rate, updated_at = await official_usd_sale_rate()
    total_ars = money(payload.total_usd * rate)
    return {
        "reference": payload.reference,
        "currency": "ARS",
        "totalUsd": str(money(payload.total_usd)),
        "exchangeRate": str(rate),
        "totalArs": str(total_ars),
        "source": "DolarApi official USD sale rate",
        "updatedAt": updated_at,
        "quoteId": sign_quote(payload.reference, payload.total_usd, total_ars, rate, updated_at),
    }


@router.post("/stripe/intent")
async def create_stripe_intent(
    payload: StripeIntentRequest,
    authorization: str | None = Header(default=None),
):
    require_internal_token(authorization)
    secret = require_test_credential("STRIPE_SECRET_KEY", "sk_test_")
    total_cents = int(money(payload.total_usd) * 100)
    if total_cents < 50:
        raise HTTPException(status_code=400, detail="Stripe's minimum payment is not met")
    intent = await stripe_request(
        "POST",
        "payment_intents",
        secret,
        data={
            "amount": total_cents,
            "currency": "usd",
            "automatic_payment_methods[enabled]": "true",
            "receipt_email": payload.email,
            "metadata[reference]": payload.reference,
        },
        headers={"Idempotency-Key": payload.reference},
    )
    if not isinstance(intent.get("id"), str) or not isinstance(intent.get("client_secret"), str):
        raise HTTPException(status_code=502, detail="Stripe did not return a usable payment intent")
    return {"paymentIntentId": intent["id"], "clientSecret": intent["client_secret"]}


@router.post("/stripe/verify")
async def verify_stripe_payment(
    payload: StripeVerifyRequest,
    authorization: str | None = Header(default=None),
):
    require_internal_token(authorization)
    secret = require_test_credential("STRIPE_SECRET_KEY", "sk_test_")
    intent = await stripe_request(
        "GET",
        f"payment_intents/{payload.payment_intent_id}",
        secret,
    )
    if intent.get("metadata", {}).get("reference") != payload.reference:
        raise HTTPException(status_code=400, detail="Payment reference does not match")
    if intent.get("currency") != "usd" or intent.get("amount") != int(money(payload.total_usd) * 100):
        raise HTTPException(status_code=400, detail="Payment amount does not match the order")
    return {"status": intent.get("status"), "approved": intent.get("status") == "succeeded"}


@router.post("/mercadopago/charge")
async def charge_mercado_pago(
    payload: MercadoPagoChargeRequest,
    authorization: str | None = Header(default=None),
):
    require_internal_token(authorization)
    access_token = require_test_credential("MERCADOPAGO_ACCESS_TOKEN", "TEST-")
    quote = verify_quote(payload.quote_id, payload.reference, payload.total_usd)
    payment_body: dict[str, Any] = {
        "transaction_amount": float(Decimal(quote["total_ars"])),
        "token": payload.token,
        "description": "Lumina Commerce order",
        "installments": payload.installments,
        "payment_method_id": payload.payment_method_id,
        "external_reference": payload.reference,
        "payer": {
            "email": payload.payer_email,
            "first_name": payload.cardholder_name,
            "identification": {
                "type": payload.identification_type,
                "number": re.sub(r"\D", "", payload.identification_number),
            },
        },
    }
    if payload.issuer_id:
        payment_body["issuer_id"] = payload.issuer_id

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.mercadopago.com/v1/payments",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Idempotency-Key": payload.reference,
                },
                json=payment_body,
            )
        payment = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(status_code=502, detail="Mercado Pago could not be reached") from error

    if response.is_error or not isinstance(payment, dict) or not payment.get("id"):
        raise HTTPException(status_code=502, detail="Mercado Pago rejected the payment request")
    if payment.get("external_reference") != payload.reference:
        raise HTTPException(status_code=502, detail="Mercado Pago returned a mismatched payment")
    return {
        "paymentId": str(payment["id"]),
        "status": payment.get("status", "unknown"),
        "statusDetail": payment.get("status_detail"),
        "currency": payment.get("currency_id"),
        "totalArs": str(quote["total_ars"]),
    }


@router.post("/mercadopago/verify")
async def verify_mercado_pago_payment(
    payload: MercadoPagoVerifyRequest,
    authorization: str | None = Header(default=None),
):
    require_internal_token(authorization)
    access_token = require_test_credential("MERCADOPAGO_ACCESS_TOKEN", "TEST-")
    quote = verify_quote(
        payload.quote_id,
        payload.reference,
        payload.total_usd,
        require_unexpired=False,
    )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                f"https://api.mercadopago.com/v1/payments/{payload.payment_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        payment = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(status_code=502, detail="Mercado Pago could not be reached") from error

    if response.is_error or not isinstance(payment, dict):
        raise HTTPException(status_code=502, detail="Mercado Pago payment could not be verified")
    if (
        payment.get("external_reference") != payload.reference
        or payment.get("currency_id") != "ARS"
        or money(Decimal(str(payment.get("transaction_amount", "0")))) != money(Decimal(quote["total_ars"]))
    ):
        raise HTTPException(status_code=400, detail="Payment details do not match the order")
    return {
        "status": payment.get("status", "unknown"),
        "approved": payment.get("status") == "approved",
    }


@router.get("/health")
async def payment_health(authorization: str | None = Header(default=None)):
    require_internal_token(authorization)
    return {"status": "ok"}
