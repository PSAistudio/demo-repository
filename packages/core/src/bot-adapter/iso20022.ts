import { randomUUID } from "crypto";

export interface Pacs008Message {
  header: {
    messageId: string;
    creationDate: string;
    numberOfTransactions: number;
  };
  grpHdr: {
    msgId: string;
    creDtTm: string;
    nbOfTxs: string;
    ctrlSum: number;
    instgAgt: string;
    instgAgtBIC: string;
  };
  cdtTrfTxInf: Array<{
    pmtId: {
      instrId: string;
      endToEndId: string;
      txId: string;
    };
    amt: {
      instructedAmt: number;
      ccy: string;
    };
    cdtrAgt: {
      finInstnId: {
        bic: string;
        clrsys: string;
        mmbId: string;
      };
    };
    cdtr: {
      nm: string;
      id: {
        orgId: {
          othr: Array<{
            id: string;
            schmeNm: string;
          }>;
        };
      };
    };
    cdtrAcct: {
      id: {
        othr: {
          id: string;
        };
      };
      ccy: string;
    };
    dbtrAgt: {
      finInstnId: {
        bic: string;
        clrsys: string;
        mmbId: string;
      };
    };
    dbtr: {
      nm: string;
      id: {
        orgId: {
          othr: Array<{
            id: string;
            schmeNm: string;
          }>;
        };
      };
    };
    dbtrAcct: {
      id: {
        othr: {
          id: string;
        };
      };
      ccy: string;
    };
    rmtInf: string;
  }>;
}

export interface Pacs002Message {
  header: {
    messageId: string;
    creationDate: string;
  };
  grpHdr: {
    msgId: string;
    creDtTm: string;
    orgnlMsgId: string;
    orgnlMsgNmId: string;
  };
  txInfAndSts: Array<{
    orgnlEndToEndId: string;
    orgnlTxId: string;
    txSts: "ACCP" | "RJCT" | "PEND";
    stsRsnInf?: {
      rsnCd: string;
      addtlInf: string;
    };
    accptncDtTm?: string;
  }>;
}

export function generateMessageId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const uuid = randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
  return `MSG-${timestamp}-${uuid}`;
}

export function buildPacs008(params: {
  instrId: string;
  endToEndId: string;
  amount: number;
  currency: string;
  creditorBIC: string;
  creditorName: string;
  creditorAccountId: string;
  creditorId?: string;
  debtorBIC: string;
  debtorName: string;
  debtorAccountId: string;
  debtorId?: string;
  remittanceInfo?: string;
}): Pacs008Message {
  const messageId = generateMessageId();
  const now = new Date().toISOString();

  return {
    header: {
      messageId,
      creationDate: now,
      numberOfTransactions: 1,
    },
    grpHdr: {
      msgId: messageId,
      creDtTm: now,
      nbOfTxs: "1",
      ctrlSum: params.amount,
      instgAgt: params.debtorBIC,
      instgAgtBIC: params.debtorBIC,
    },
    cdtTrfTxInf: [
      {
        pmtId: {
          instrId: params.instrId,
          endToEndId: params.endToEndId,
          txId: randomUUID(),
        },
        amt: {
          instructedAmt: params.amount,
          ccy: params.currency,
        },
        cdtrAgt: {
          finInstnId: {
            bic: params.creditorBIC,
            clrsys: "THBRT",
            mmbId: params.creditorBIC.slice(0, 4),
          },
        },
        cdtr: {
          nm: params.creditorName,
          id: {
            orgId: {
              othr: params.creditorId
                ? [{ id: params.creditorId, schmeNm: "TXID" }]
                : [],
            },
          },
        },
        cdtrAcct: {
          id: {
            othr: {
              id: params.creditorAccountId,
            },
          },
          ccy: params.currency,
        },
        dbtrAgt: {
          finInstnId: {
            bic: params.debtorBIC,
            clrsys: "THBRT",
            mmbId: params.debtorBIC.slice(0, 4),
          },
        },
        dbtr: {
          nm: params.debtorName,
          id: {
            orgId: {
              othr: params.debtorId
                ? [{ id: params.debtorId, schmeNm: "TXID" }]
                : [],
            },
          },
        },
        dbtrAcct: {
          id: {
            othr: {
              id: params.debtorAccountId,
            },
          },
          ccy: params.currency,
        },
        rmtInf: params.remittanceInfo ?? "",
      },
    ],
  };
}

export function parsePacs008(raw: string): Pacs008Message {
  try {
    const parsed = JSON.parse(raw) as Pacs008Message;
    if (!parsed.header?.messageId || !parsed.cdtTrfTxInf?.length) {
      throw new Error("Invalid PACS.008 message structure");
    }
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse PACS.008 message: ${err.message}`);
    }
    throw err;
  }
}

export function buildPacs002(params: {
  originalMsgId: string;
  originalEndToEndId: string;
  originalTxId: string;
  txStatus: "ACCP" | "RJCT" | "PEND";
  reasonCode?: string;
  additionalInfo?: string;
  acceptanceDateTime?: string;
}): Pacs002Message {
  const messageId = generateMessageId();
  const now = new Date().toISOString();

  return {
    header: {
      messageId,
      creationDate: now,
    },
    grpHdr: {
      msgId: messageId,
      creDtTm: now,
      orgnlMsgId: params.originalMsgId,
      orgnlMsgNmId: "pacs.008.001.08",
    },
    txInfAndSts: [
      {
        orgnlEndToEndId: params.originalEndToEndId,
        orgnlTxId: params.originalTxId,
        txSts: params.txStatus,
        ...(params.reasonCode
          ? {
              stsRsnInf: {
                rsnCd: params.reasonCode,
                addtlInf: params.additionalInfo ?? "",
              },
            }
          : {}),
        ...(params.txStatus === "ACCP"
          ? { accptncDtTm: params.acceptanceDateTime ?? now }
          : {}),
      },
    ],
  };
}
