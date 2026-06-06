import { db } from "@thai-bank/db";

interface AuthResult {
  authenticated: boolean;
  userId?: string;
  organizationId?: string;
  error?: string;
}

export async function authenticateRequest(
  request: Request
): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("X-Api-Key");

  // API Key authentication
  if (apiKeyHeader) {
    const keyPrefix = apiKeyHeader.slice(0, 8);
    const apiKey = await db
      .selectFrom("api_keys")
      .selectAll()
      .where("key_prefix", "=", keyPrefix)
      .where("is_active", "=", true)
      .executeTakeFirst();

    if (!apiKey) {
      return { authenticated: false, error: "Invalid API key" };
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return { authenticated: false, error: "API key has expired" };
    }

    // Update last used timestamp
    await db
      .updateTable("api_keys")
      .set({ last_used_at: new Date() })
      .where("id", "=", apiKey.id)
      .execute();

    return {
      authenticated: true,
      userId: apiKey.created_by,
      organizationId: apiKey.organization_id ?? undefined,
    };
  }

  // Bearer token / session authentication
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const session = await db
      .selectFrom("sessions")
      .selectAll()
      .where("token", "=", token)
      .executeTakeFirst();

    if (!session) {
      return { authenticated: false, error: "Invalid or expired session token" };
    }

    if (new Date(session.expires_at) < new Date()) {
      return { authenticated: false, error: "Session has expired" };
    }

    return {
      authenticated: true,
      userId: session.user_id,
    };
  }

  return { authenticated: false, error: "Missing authentication credentials" };
}

export function requireAuth(
  handler: (request: Request, context: { userId: string; organizationId?: string }) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: authResult.error ?? "Authentication required",
          },
        },
        { status: 401 }
      );
    }

    return handler(request, {
      userId: authResult.userId!,
      organizationId: authResult.organizationId,
    });
  };
}
