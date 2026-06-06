import {
  initiatePromptPayTransfer,
  inquiryPromptPay,
  initiateInterbankTransfer,
} from "@thai-bank/core";
import type { ApiResponse } from "./index.js";

export async function handlePromptPayTransfer(
  request: Request
): Promise<Response> {
  const body = (await request.json()) as {
    fromAccountId: string;
    toTaxId?: string;
    toCitizenId?: string;
    toPhoneNumber?: string;
    amount: number;
    currency: string;
    description?: string;
  };

  if (!body.fromAccountId || !body.amount || !body.currency) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required fields: fromAccountId, amount, currency",
        },
      },
      { status: 400 }
    );
  }

  if (!body.toTaxId && !body.toCitizenId && !body.toPhoneNumber) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "One of toTaxId, toCitizenId, or toPhoneNumber must be provided",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await initiatePromptPayTransfer({
      fromAccountId: body.fromAccountId,
      toTaxId: body.toTaxId,
      toCitizenId: body.toCitizenId,
      toPhoneNumber: body.toPhoneNumber,
      amount: body.amount,
      currency: body.currency as "THB",
      description: body.description ?? "PromptPay transfer",
      initiatedBy: "system",
    });

    return Response.json(
      { success: true, data: result } satisfies ApiResponse,
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      {
        success: false,
        error: { code: "TRANSFER_FAILED", message },
      },
      { status: 500 }
    );
  }
}

export async function handlePromptPayInquiry(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const citizenId = url.searchParams.get("citizenId");
  const taxId = url.searchParams.get("taxId");
  const phoneNumber = url.searchParams.get("phoneNumber");

  if (!citizenId && !taxId && !phoneNumber) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "One of citizenId, taxId, or phoneNumber query parameter is required",
        },
      },
      { status: 400 }
    );
  }

  try {
    const inquiryParams = citizenId
      ? { citizenId }
      : taxId
        ? { taxId }
        : { phoneNumber: phoneNumber! };

    const result = await inquiryPromptPay(inquiryParams);
    return Response.json({ success: true, data: result } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "INQUIRY_FAILED", message } },
      { status: 404 }
    );
  }
}

export async function handleInterbankTransfer(
  request: Request
): Promise<Response> {
  const body = (await request.json()) as {
    fromAccountId: string;
    toAccountNo: string;
    toBankCode: string;
    toAccountName: string;
    amount: number;
    currency: string;
    channel: "BAHTNET" | "ITMX";
    description?: string;
  };

  if (
    !body.fromAccountId ||
    !body.toAccountNo ||
    !body.toBankCode ||
    !body.toAccountName ||
    !body.amount ||
    !body.currency ||
    !body.channel
  ) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Missing required fields: fromAccountId, toAccountNo, toBankCode, toAccountName, amount, currency, channel",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await initiateInterbankTransfer({
      fromAccountId: body.fromAccountId,
      toAccountNo: body.toAccountNo,
      toBankCode: body.toBankCode,
      toAccountName: body.toAccountName,
      amount: body.amount,
      currency: body.currency as "THB",
      channel: body.channel,
      description: body.description ?? "Interbank transfer",
      initiatedBy: "system",
    });

    return Response.json(
      { success: true, data: result } satisfies ApiResponse,
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      {
        success: false,
        error: { code: "TRANSFER_FAILED", message },
      },
      { status: 500 }
    );
  }
}
