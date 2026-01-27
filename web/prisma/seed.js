import pkg from "@prisma/client";
const {
  PrismaClient,
  AccountType,
  FinancialAccountType,
  ThreadSourceType,
  ThreadStatus,
  InternalControlRuleType,
  InternalControlSeverity,
} = pkg;

const THREAD_SOURCE = ThreadSourceType ?? {
  TODO: "TODO",
  EVENT: "EVENT",
  ACCOUNTING: "ACCOUNTING",
  DOCUMENT: "DOCUMENT",
  FREE: "FREE",
};

const THREAD_STATUS = ThreadStatus ?? {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
};
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.todoItem.deleteMany();
  await prisma.todoItem.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.eventBudgetImport.deleteMany();
  await prisma.eventTransaction.deleteMany();
  await prisma.eventBudget.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.event.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.ledger.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.financialAccount.deleteMany();
  await prisma.account.deleteMany();
  await prisma.accountingSetting.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.inviteCode.deleteMany();
  await prisma.member.deleteMany();
  await prisma.group.deleteMany();

  const group = await prisma.group.create({
    data: {
      name: 'Demo Group',
      fiscalYearStartMonth: 4,
      enabledModules: [
        "event",
        "event-budget",
        "calendar",
        "accounting",
        "management",
        "chat",
        "todo",
        "store",
        "export",
        "document",
        "audit",
      ],
    },
  });

  const accountingSetting = await prisma.accountingSetting.create({
    data: {
      groupId: group.id,
      fiscalYearStartMonth: group.fiscalYearStartMonth,
      fiscalYearEndMonth: 3,
      approvalFlow: '会計係 → 管理者 → 監査',
      carryoverAmount: 50000,
      budgetEnabled: true,
    },
  });

  const adminPasswordHash = await bcrypt.hash("password123", 10);
  const accountantPasswordHash = await bcrypt.hash("password123", 10);

  const owner = await prisma.member.create({
    data: {
      groupId: group.id,
      displayName: 'Demo Owner',
        role: "ADMIN",
        email: "demo-admin@example.com",
      passwordHash: adminPasswordHash,
    },
  });

  const accountant = await prisma.member.create({
    data: {
      groupId: group.id,
      displayName: 'Demo Accountant',
        role: "ACCOUNTANT",
        email: "demo-accountant@example.com",
      passwordHash: accountantPasswordHash,
    },
  });

  await prisma.internalControlRule.createMany({
    data: [
      {
        groupId: group.id,
        createdByMemberId: owner.id,
        name: "職務分掌: 作成者と承認者の分離",
        description:
          "Ledgerの作成者と承認者が同一の場合に警告を出します。",
        ruleType: InternalControlRuleType.SEGREGATION_OF_DUTIES,
        conditionJson: { forbidSelfApprove: true },
        severity: InternalControlSeverity.WARN,
      },
      {
        groupId: group.id,
        createdByMemberId: owner.id,
        name: "高額経費の複数承認",
        description: "5万円以上の経費は2名以上の承認が必要です。",
        ruleType: InternalControlRuleType.MULTI_APPROVAL_FOR_AMOUNT,
        conditionJson: { amountGte: 50000, requiredApprovals: 2 },
        severity: InternalControlSeverity.CRITICAL,
      },
      {
        groupId: group.id,
        createdByMemberId: owner.id,
        name: "承認なし確定の禁止",
        description: "承認ゼロで確定したLedgerを検出します。",
        ruleType: InternalControlRuleType.NO_APPROVAL_NO_CONFIRM,
        conditionJson: { requireApprovalCount: 1 },
        severity: InternalControlSeverity.CRITICAL,
      },
      {
        groupId: group.id,
        createdByMemberId: owner.id,
        name: "証憑リンクの欠落検知",
        description: "sourceThreadIdまたはsourceChatMessageIdが無い記録を抽出します。",
        ruleType: InternalControlRuleType.MISSING_SOURCE_LINK,
        conditionJson: { requireSourceLink: true },
        severity: InternalControlSeverity.INFO,
      },
    ],
  });

  const defaultAccounts = [
    { name: '現金', type: AccountType.ASSET },
    { name: '普通預金', type: AccountType.ASSET },
    { name: '定期預金', type: AccountType.ASSET },
    { name: '会費収入', type: AccountType.INCOME },
    { name: '事業収入', type: AccountType.INCOME },
    { name: '補助金等収入', type: AccountType.INCOME },
    { name: '寄附金収入', type: AccountType.INCOME },
    { name: '雑収入', type: AccountType.INCOME },
    { name: '受取利息', type: AccountType.INCOME },
    { name: '受取配当金', type: AccountType.INCOME },
    { name: '給与賃金', type: AccountType.EXPENSE },
    { name: '地代家賃', type: AccountType.EXPENSE },
    { name: '租税公課', type: AccountType.EXPENSE },
    { name: '水道光熱費', type: AccountType.EXPENSE },
    { name: '旅費交通費', type: AccountType.EXPENSE },
    { name: '通信費', type: AccountType.EXPENSE },
    { name: '消耗品費', type: AccountType.EXPENSE },
    { name: '修繕費', type: AccountType.EXPENSE },
    { name: '支払手数料', type: AccountType.EXPENSE },
    { name: '広告宣伝費', type: AccountType.EXPENSE },
    { name: '会議費', type: AccountType.EXPENSE },
    { name: '交際費', type: AccountType.EXPENSE },
    { name: '支払保険料', type: AccountType.EXPENSE },
    { name: '福利厚生費', type: AccountType.EXPENSE },
    { name: '減価償却費', type: AccountType.EXPENSE },
    { name: '雑費', type: AccountType.EXPENSE },
  ];

  await prisma.account.createMany({
    data: defaultAccounts.map((account, index) => ({
      groupId: group.id,
      name: account.name,
      type: account.type,
      isCustom: false,
      order: index,
    })),
  });

  const accounts = await prisma.account.findMany({
    where: { groupId: group.id },
  });

  const accountByName = Object.fromEntries(
    accounts.map((account) => [account.name, account])
  );

  const currentYear = new Date().getFullYear();

  await prisma.budget.createMany({
    data: [
      {
        groupId: group.id,
        accountId: accountByName["会費収入"].id,
        fiscalYear: currentYear,
        amount: 300000,
      },
      {
        groupId: group.id,
        accountId: accountByName["事業収入"].id,
        fiscalYear: currentYear,
        amount: 120000,
      },
      {
        groupId: group.id,
        accountId: accountByName["補助金等収入"].id,
        fiscalYear: currentYear,
        amount: 80000,
      },
      {
        groupId: group.id,
        accountId: accountByName["水道光熱費"].id,
        fiscalYear: currentYear,
        amount: 20000,
      },
      {
        groupId: group.id,
        accountId: accountByName["旅費交通費"].id,
        fiscalYear: currentYear,
        amount: 50000,
      },
      {
        groupId: group.id,
        accountId: accountByName["消耗品費"].id,
        fiscalYear: currentYear,
        amount: 70000,
      },
    ],
  });

  await prisma.financialAccount.createMany({
    data: [
      {
        groupId: group.id,
        name: "現金",
        type: FinancialAccountType.CASH,
        initialBalance: 20000,
        currentBalance: 20000,
      },
      {
        groupId: group.id,
        name: "ゆうちょ銀行",
        type: FinancialAccountType.BANK,
        bankName: "ゆうちょ銀行",
        accountNumber: "1234567",
        initialBalance: 80000,
        currentBalance: 80000,
      },
    ],
  });

  await prisma.inviteCode.createMany({
    data: [
      {
        groupId: group.id,
        code: "DEMO1234",
        role: "MEMBER",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        groupId: group.id,
        code: "ACCT1234",
        role: "ACCOUNTANT",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  await prisma.ledger.create({
    data: {
      groupId: group.id,
      createdByMemberId: accountant.id,
      title: "イベント備品購入",
      amount: 12000,
      transactionDate: new Date(),
      receiptUrl: 'https://example.com/receipt/demo',
      notes: 'ボールとビブス',
      status: "PENDING",
      accountId: accountByName["消耗品費"].id,
    },
  });

  // --- 2024年度（2024年4月〜2025年3月）のLedger 100件 ---
  const incomeAccounts = [
    { name: "会費収入", titles: ["年会費徴収", "会費納入", "追加会費"] },
    { name: "事業収入", titles: ["バザー売上", "教室参加費", "講座収入"] },
    { name: "補助金等収入", titles: ["市補助金交付", "県助成金", "活動助成"] },
    { name: "寄附金収入", titles: ["寄附金受領", "協賛金", "特別寄附"] },
    { name: "雑収入", titles: ["利息入金", "雑入", "物品売却"] },
    { name: "受取利息", titles: ["普通預金利息", "定期預金利息", "利子収入"] },
    { name: "受取配当金", titles: ["配当金受領", "分配金入金", "投資収益"] },
  ];

  const expenseAccounts = [
    { name: "給与賃金", titles: ["講師謝礼", "アルバイト代", "手当支給"] },
    { name: "地代家賃", titles: ["会議室使用料", "事務所家賃", "駐車場代"] },
    { name: "租税公課", titles: ["印紙代", "証明書手数料", "登録免許税"] },
    { name: "水道光熱費", titles: ["電気代", "水道代", "ガス代"] },
    { name: "旅費交通費", titles: ["タクシー代", "電車代", "出張旅費"] },
    { name: "通信費", titles: ["切手代", "電話料金", "インターネット代"] },
    { name: "消耗品費", titles: ["文房具購入", "コピー用紙", "トナー購入"] },
    { name: "修繕費", titles: ["設備修理", "備品修繕", "施設補修"] },
    { name: "支払手数料", titles: ["振込手数料", "代行手数料", "事務手数料"] },
    { name: "広告宣伝費", titles: ["チラシ印刷", "ポスター制作", "広報費"] },
    { name: "会議費", titles: ["茶菓子代", "弁当代", "飲料代"] },
    { name: "交際費", titles: ["お礼品", "慶弔費", "手土産代"] },
    { name: "支払保険料", titles: ["行事保険", "賠償保険", "火災保険"] },
    { name: "福利厚生費", titles: ["親睦会費", "記念品代", "健康診断"] },
    { name: "減価償却費", titles: ["パソコン償却", "プリンター償却", "備品償却"] },
  ];

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  const fy2024Start = new Date(2024, 3, 1);   // 2024年4月1日
  const fy2024End = new Date(2025, 2, 31);     // 2025年3月31日

  const ledgerData = [];
  const creators = [owner.id, accountant.id];

  // 収入 30件
  for (let i = 0; i < 30; i++) {
    const acc = incomeAccounts[i % incomeAccounts.length];
    const titleList = acc.titles;
    ledgerData.push({
      groupId: group.id,
      createdByMemberId: creators[i % creators.length],
      title: titleList[i % titleList.length],
      amount: randomInt(5000, 100000),
      transactionDate: randomDate(fy2024Start, fy2024End),
      notes: `${acc.name}（自動生成）`,
      status: "APPROVED",
      accountId: accountByName[acc.name].id,
    });
  }

  // 支出 70件
  for (let i = 0; i < 70; i++) {
    const acc = expenseAccounts[i % expenseAccounts.length];
    const titleList = acc.titles;
    ledgerData.push({
      groupId: group.id,
      createdByMemberId: creators[i % creators.length],
      title: titleList[i % titleList.length],
      amount: randomInt(1000, 50000),
      transactionDate: randomDate(fy2024Start, fy2024End),
      notes: `${acc.name}（自動生成）`,
      status: "APPROVED",
      accountId: accountByName[acc.name].id,
    });
  }

  await prisma.ledger.createMany({ data: ledgerData });
  console.log(`  → 2024年度 Ledger ${ledgerData.length}件を作成しました`);

  const event = await prisma.event.create({
    data: {
      groupId: group.id,
      title: "4月定例会",
      description: "年間予定と役割分担を行います。",
      location: "市民センター 第1会議室",
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.attendance.create({
    data: {
      eventId: event.id,
      memberId: owner.id,
      status: "YES",
      comment: "参加します。",
    },
  });

  await prisma.attendance.create({
    data: {
      eventId: event.id,
      memberId: accountant.id,
      status: "MAYBE",
      comment: "日程調整中です。",
    },
  });

  const chatThread = await prisma.chatThread.create({
    data: {
      groupId: group.id,
      title: "FREEスレッド",
      sourceType: THREAD_SOURCE.FREE,
      status: THREAD_STATUS.OPEN,
    },
  });

  await prisma.chatMessage.createMany({
    data: [
      {
        threadId: chatThread.id,
        groupId: group.id,
        authorId: owner.id,
        body: "ようこそ Knot Chat へ。ここから次のアクションを決めていきましょう。",
      },
      {
        threadId: chatThread.id,
        groupId: group.id,
        authorId: accountant.id,
        body: "まずは次回イベントの準備タスクを整理します。",
      },
    ],
  });

  console.log("Seed completed:", {
    group,
    accountingSetting,
    owner,
    accountant,
    event,
    chatThread,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
