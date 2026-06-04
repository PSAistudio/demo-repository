import { db } from "@thai-bank/db";
import type { AccountType, AccountStatus } from "@thai-bank/db/schemas";
import { openAccount, closeAccount, freezeAccount, unfreezeAccount } from "@thai-bank/core";
import type { ApiResponse } from "./index.js";

interface AccountListQuery {
  status?: AccountStatus;
  type?: AccountType;
  page?: string;
  limit?: string;
}

export async function handleListAccounts(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as AccountStatus | null;
  const type = url.searchParams.get("type") as AccountType | null;
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "20", 10),
    100
  );
  const offset = (page - 1) * limit;

  let query = db.selectFrom("accounts").selectAll();

  if (status) {
    query = query.where("status", "=", status);
  }
  if (type) {
    query = query.where("account_type", "=", type);
  }

  const [accounts, countResult] = await Promise.all([
    query.limit(limit).offset(offset).orderBy("created_at", "desc").execute(),
    db
      .selectFrom("accounts")
      .select(({ fn }) => [fn.countAll().as("total")])
      .$if(!!status, (qb) => qb.where("status", "=", status!))
      .$if(!!type, (qb) => qb.where("account_type", "=", type!))
      .executeTakeFirst(),
  ]);

  const total = Number(countResult?.total ?? 0);

  return Response.json({
    success: true,
    data: accounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  } satisfies ApiResponse);
}

export async function handleGetAccount(
  request: Request,
  id: string
): Promise<Response> {
  const account = await db
    .selectFrom("accounts")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!account) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: `Account ${id} not found` } },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: account } satisfies ApiResponse);
}

export async function handleCreateAccount(
  request: Request
): Promise<Response> {
  const body = (await request.json()) as {
    accountType: AccountType;
    currency: string;
    branchCode: string;
    productCode: string;
    citizenId?: string;
    taxId?: string;
    phoneNumber?: string;
    initialDeposit?: number;
  };

  if (!body.accountType || !body.currency || !body.branchCode || !body.productCode) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields: accountType, currency, branchCode, productCode",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await openAccount({
      accountType: body.accountType,
      currency: body.currency as "THB",
      branchCode: body.branchCode,
      productCode: body.productCode,
      citizenId: body.citizenId,
      taxId: body.taxId,
      phoneNumber: body.phoneNumber,
      initialDeposit: body.initialDeposit,
      openedBy: "system",
    });

    return Response.json(
      { success: true, data: result } satisfies ApiResponse,
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "ACCOUNT_CREATION_FAILED", message } },
      { status: 500 }
    );
  }
}

export async function handleUpdateAccountStatus(
  request: Request,
  id: string
): Promise<Response> {
  const body = (await request.json()) as {
    action: "close" | "freeze" | "unfreeze";
    reason?: string;
  };

  if (!body.action) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Missing required field: action" },
      },
      { status: 400 }
    );
  }

  try {
    switch (body.action) {
      case "close":
        await closeAccount(id, "system");
        break;
      case "freeze":
        await freezeAccount(id, body.reason ?? "Administrative freeze", "system");
        break;
      case "unfreeze":
        await unfreezeAccount(id, "system");
        break;
      default:
        return Response.json(
          {
            success: false,
            error: { code: "INVALID_ACTION", message: `Unknown action: ${body.action}` },
          },
          { status: 400 }
        );
    }

    const updated = await db
      .selectFrom("accounts")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return Response.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { success: false, error: { code: "STATUS_UPDATE_FAILED", message } },
      { status: 500 }
    );
  }
}
